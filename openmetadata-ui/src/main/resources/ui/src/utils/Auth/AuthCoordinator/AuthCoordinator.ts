/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import type { AxiosInstance } from 'axios';
import {
  EXPIRY_THRESHOLD_MILLES,
  extractDetailsFromToken,
} from '../../AuthProvider.util';
import { getOidcToken, setOidcToken } from '../../SwTokenStorageUtils';
import { CrossTabLock, LockTimeoutError } from './CrossTabLock';
import { TypedEventBus } from './eventBus';
import { ProactiveTimer } from './ProactiveTimer';
import { RefreshQueue } from './RefreshQueue';
import type {
  AuthCoordinatorEvent,
  EventPayloadMap,
  Renewer,
  RenewResult,
  Unsubscribe,
} from './types';
import { VisibilityWatcher } from './VisibilityWatcher';

type IsRefreshable = (status: number, url: string, body: unknown) => boolean;

const LOCK_NAME = 'om-refresh';
const CHANNEL_NAME = 'om-auth';
// AuthProvider's mount effect (fetchAuthConfig round-trip + lazy authenticator
// chunk) registers the renewer asynchronously, while initializeAuthState can
// call ensureFreshToken() synchronously on cold load right after mount. Wait
// briefly for that registration instead of failing the race immediately.
const RENEWER_WAIT_TIMEOUT_MS = 5_000;
// One retry is enough to serialise a "leader failed / timed out" recovery
// across every backgrounded tab: exactly one of the racing followers wins
// the freed lock and refreshes; the rest observe its broadcast. A second
// consecutive failure escalates to `refresh-failed` so the interceptor
// can force the sign-out path instead of spinning against a broken IdP.
const MAX_RECOVERY_ATTEMPTS = 1;

export class AuthCoordinator {
  private renewer: Renewer | null = null;
  private inflight: Promise<string> | null = null;
  private readonly bus = new TypedEventBus();
  private readonly queue = new RefreshQueue();
  private readonly timer = new ProactiveTimer();
  private readonly visibility = new VisibilityWatcher();
  private readonly lock = new CrossTabLock(LOCK_NAME, CHANNEL_NAME);
  // Resolves on the first non-null registerRenewer() call and stays resolved
  // for the coordinator's lifetime — later registerRenewer(null) calls (e.g.
  // unmount) do not reset it; doRefresh() re-checks `this.renewer` after the
  // wait, so a stale resolution can't mask a currently-unregistered renewer.
  private renewerReady: Promise<void>;
  private resolveRenewerReady!: () => void;

  constructor() {
    this.renewerReady = new Promise<void>((resolve) => {
      this.resolveRenewerReady = resolve;
    });
  }

  registerRenewer(renewer: Renewer | null): void {
    const wasNull = this.renewer === null;
    this.renewer = renewer;
    if (renewer && wasNull) {
      this.resolveRenewerReady();
    }
  }

  on<E extends AuthCoordinatorEvent>(
    event: E,
    cb: (payload: EventPayloadMap[E]) => void
  ): Unsubscribe {
    return this.bus.on(event, cb);
  }

  install(
    axios: AxiosInstance,
    isRefreshable: IsRefreshable,
    onRefreshStart?: () => void
  ): Unsubscribe {
    const id = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error?.response?.status;
        const url = error?.config?.url ?? '';
        const body = error?.response?.data;
        if (status !== 401 || !isRefreshable(status, url, body)) {
          throw error;
        }
        // Fire once per active refresh cycle — `inflight` is set
        // synchronously by `ensureFreshToken()` below, so only the 401 that
        // starts a new cycle (not the concurrent ones queued behind it)
        // triggers this callback.
        if (!this.inflight && onRefreshStart) {
          onRefreshStart();
        }
        const pending = this.queue.enqueue(error.config);
        this.pumpQueue(axios).catch(() => undefined);

        return pending;
      }
    );
    this.visibility.start(
      () => {
        this.onTabVisible().catch(() => undefined);
      },
      () => this.timer.cancel()
    );

    return () => {
      axios.interceptors.response.eject(id);
      this.visibility.stop();
    };
  }

  async ensureFreshToken(): Promise<string> {
    if (this.inflight) {
      return this.inflight;
    }
    this.inflight = this.doRefresh();
    try {
      return await this.inflight;
    } finally {
      this.inflight = null;
    }
  }

  pause(): void {
    this.timer.cancel();
  }

  resume(): void {
    this.ensureFreshToken().catch(() => undefined);
  }

  dispose(): void {
    this.timer.cancel();
    this.visibility.stop();
  }

  // When the tab regains visibility, browsers may have throttled or suspended
  // the proactive renewal timer, so we must re-check freshness ourselves.
  // Refresh only when the stored token is expired or within the pre-expiry
  // buffer; otherwise reschedule the timer with the correct remaining time.
  // Blindly calling ensureFreshToken() on every focus hits the IdP even when
  // the token is still valid.
  private async onTabVisible(): Promise<void> {
    try {
      const token = await getOidcToken();
      if (!token) {
        return;
      }
      const { exp, isExpired } = extractDetailsFromToken(token);
      // A missing / non-positive `exp` means the token is opaque, not a JWT
      // at all, or spec-violating. extractDetailsFromToken returns
      // `isExpired: true` for the jwt-decode-throws branch AND
      // `isExpired: false, timeoutExpiry: 0` for the isNil(exp) branch —
      // neither is signal we can act on. Leave the token in place; the
      // next real 401 will drive a refresh via the axios interceptor.
      // MUST come before the isExpired branch — otherwise opaque tokens
      // fire ensureFreshToken() on every tab focus (Greptile P1 on the
      // sibling hotfix PR).
      if (typeof exp !== 'number' || exp <= 0) {
        return;
      }
      if (isExpired) {
        await this.ensureFreshToken();

        return;
      }
      // Fire a proactive refresh when the remaining lifetime is inside the
      // pre-expiry buffer; otherwise just reschedule the timer with the
      // correct remaining time (no network call).
      const msUntilExpiry = exp * 1000 - Date.now();
      if (msUntilExpiry <= EXPIRY_THRESHOLD_MILLES) {
        await this.ensureFreshToken();

        return;
      }
      this.timer.schedule(exp * 1000, () => {
        this.ensureFreshToken().catch(() => undefined);
      });
    } catch {
      // Storage read errors fall through: the next real 401 will drive the
      // refresh via the axios interceptor.
    }
  }

  private async awaitRenewer(
    timeoutMs = RENEWER_WAIT_TIMEOUT_MS
  ): Promise<void> {
    if (this.renewer) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('No renewer registered within timeout'));
      }, timeoutMs);
      this.renewerReady.then(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private async doRefresh(): Promise<string> {
    await this.awaitRenewer();
    const renewer = this.renewer;
    if (!renewer) {
      throw new Error('No renewer registered');
    }

    return this.runExclusiveRefresh(renewer, 0);
  }

  // Recovery path is bounded to `MAX_RECOVERY_ATTEMPTS` so a broken IdP
  // cannot spin forever. Every attempt goes through `runExclusive`, which
  // keeps the "exactly one renewer() call across tabs per attempt"
  // guarantee — critical for IdPs that rotate the refresh token on use
  // (Auth0, some OIDC providers). Without the second lock acquisition,
  // N backgrounded tabs all falling back after a leader failure would
  // each fire `renewer()` concurrently against the same rotated refresh
  // token, and reuse-detection would invalidate every session.
  private async runExclusiveRefresh(
    renewer: Renewer,
    attempt: number
  ): Promise<string> {
    let outcome;
    try {
      outcome = await this.lock.runExclusive<RenewResult>(() => renewer());
    } catch (err) {
      // Follower timed out waiting for the leader (slow IdP, leader tab
      // closed mid-refresh, missed broadcast). Retry through the lock so
      // any other follower that also fell back races us for the exclusive
      // slot instead of running its own renewer in parallel.
      if (err instanceof LockTimeoutError && attempt < MAX_RECOVERY_ATTEMPTS) {
        return this.runExclusiveRefresh(renewer, attempt + 1);
      }
      // Leader's own renewer threw. `runExclusive` already broadcast
      // `failed` to followers; propagate the failure here. Also the
      // bounded-retry give-up path: emit `refresh-failed` so downstream
      // consumers (interceptors, the queue drain) see the same signal.
      const reason = err instanceof Error ? err.message : String(err);
      this.bus.emit('refresh-failed', { reason });

      throw err;
    }

    if (outcome.role === 'follower') {
      const message = outcome.message;
      if (message.type === 'done' && this.isRenewResult(message.payload)) {
        return this.applyRefreshed(message.payload);
      }

      // Leader broadcast `failed` (or `done` without a usable payload).
      // Retry once more through the lock — the leader has released it and
      // this tab (or one of its peers) will take over. Serialisation
      // across tabs is preserved; a bad IdP still terminates after
      // `MAX_RECOVERY_ATTEMPTS` rather than turning into a refresh storm.
      if (attempt < MAX_RECOVERY_ATTEMPTS) {
        return this.runExclusiveRefresh(renewer, attempt + 1);
      }
      const reason =
        message.type === 'failed'
          ? message.reason ?? 'leader failed after retries'
          : 'leader broadcast unusable payload after retries';
      this.bus.emit('refresh-failed', { reason });

      throw new Error(reason);
    }

    const result = outcome.value;
    // Persist BEFORE broadcasting so a sibling tab that immediately reads
    // storage can never observe the old expired token behind a fresh
    // `done`.
    await setOidcToken(result.idToken);
    this.lock.notifyDone(result);

    return this.applyRefreshed(result);
  }

  private applyRefreshed(result: RenewResult): string {
    this.bus.emit('refreshed', {
      expiresAt: result.expiresAt,
      idToken: result.idToken,
    });
    this.timer.schedule(result.expiresAt, () => {
      this.ensureFreshToken().catch(() => undefined);
    });

    return result.idToken;
  }

  private isRenewResult(value: unknown): value is RenewResult {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const v = value as { idToken?: unknown; expiresAt?: unknown };

    return (
      typeof v.idToken === 'string' &&
      v.idToken.length > 0 &&
      typeof v.expiresAt === 'number' &&
      v.expiresAt > Date.now() - EXPIRY_THRESHOLD_MILLES
    );
  }

  private async pumpQueue(axios: AxiosInstance): Promise<void> {
    try {
      const token = await this.ensureFreshToken();
      await this.queue.drain(token, axios);
    } catch {
      await this.queue.drain(null, axios);
    }
  }
}

export const authCoordinator = new AuthCoordinator();
