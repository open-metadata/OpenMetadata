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
import { getOidcToken, setOidcTokenStrict } from '../../SwTokenStorageUtils';
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

const MAX_PER_REQUEST_RETRIES = 2;
const MAX_REFRESH_CYCLES_PER_WINDOW = 3;
const REFRESH_WINDOW_MS = 30_000;
const REFRESH_FAILED_EVENT: AuthCoordinatorEvent = 'refresh-failed';

export class AuthCoordinator {
  private renewer: Renewer | null = null;
  private inflight: Promise<string> | null = null;
  private refreshCycleTimestamps: number[] = [];
  // The most recently minted access token — updated on every
  // successful refresh HERE (via applyRefreshed) AND from sibling
  // tabs (via CrossTabLock's channel — see the onDoneBroadcast
  // subscription in install). Used synchronously by the interceptor
  // to distinguish a "current token is being rejected" real refresh
  // loop from an in-flight straggler carrying a pre-refresh token.
  private lastMintedToken: string | null = null;
  private disposeCrossTabDone: (() => void) | null = null;
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

        const cfg = error.config as { __omAuthRetries?: number } | undefined;
        const retries = (cfg?.__omAuthRetries ?? 0) + 1;
        if (cfg) {
          cfg.__omAuthRetries = retries;
        }
        if (retries > MAX_PER_REQUEST_RETRIES) {
          // A single endpoint that keeps 401'ing after refreshes should
          // fail its own request, not sign the whole app out — the rest
          // of the session may be perfectly healthy. Global recovery
          // still runs via the sliding-window cycle circuit-breaker.
          throw error;
        }

        const countCycle = this.shouldCountNewCycle(error.config);
        if (countCycle) {
          if (this.recordCycleAndCheckBreaker()) {
            throw error;
          }
          if (onRefreshStart) {
            onRefreshStart();
          }
        }

        const pending = this.queue.enqueue(error.config);
        // Force refresh only for cycles we counted (the failing token
        // IS the current stored one, so the fast-path would just hand
        // it back). Stragglers carrying a pre-refresh token retry
        // through the fast-path, which returns the already-minted
        // fresh token without hitting the IdP — one refresh per burst
        // instead of one per straggler (Greptile P1 r4072893165).
        this.pumpQueue(axios, { force: countCycle }).catch(() => undefined);

        return pending;
      }
    );
    this.visibility.start(
      () => {
        this.onTabVisible().catch(() => undefined);
      },
      () => this.timer.cancel()
    );

    // Keep `lastMintedToken` in sync with sibling tabs so the cycle
    // circuit-breaker recognises a cross-tab-minted token as
    // "current" and can still trip on a persistent 401 storm even
    // when this tab wasn't the one that refreshed.
    this.disposeCrossTabDone?.();
    this.disposeCrossTabDone = this.lock.onDoneBroadcast((payload) => {
      const token = this.extractIdToken(payload);
      if (token) {
        this.lastMintedToken = token;
      }
    });

    return () => {
      axios.interceptors.response.eject(id);
      this.visibility.stop();
      this.disposeCrossTabDone?.();
      this.disposeCrossTabDone = null;
    };
  }

  async ensureFreshToken(options: { force?: boolean } = {}): Promise<string> {
    const force = options.force ?? false;

    if (!force && !this.inflight) {
      // Fast-path: reuse a still-time-fresh stored token (another tab
      // may have already refreshed it) instead of hitting the IdP.
      // `force:true` callers skip this because a 401 IS proof the
      // stored token is server-rejected regardless of `exp`. Also skip
      // while OUR own refresh is in flight: storage may still hold the
      // stale, server-rejected token until the refresh persists —
      // returning `this.inflight` below yields the freshly-minted
      // token instead of racing the write.
      try {
        const stored = await getOidcToken();
        // Re-check `this.inflight` AFTER the storage read: a
        // concurrent `ensureFreshToken({force:true})` (e.g. from the
        // 401 interceptor) may have set it during our await. Falling
        // through to the inflight join below yields the freshly-
        // minted token instead of the stale one storage just handed
        // us (code-review finding).
        if (!this.inflight && stored) {
          const { exp } = extractDetailsFromToken(stored);
          if (typeof exp !== 'number' || exp <= 0) {
            return stored;
          }
          const msRemaining = exp * 1000 - Date.now();
          if (msRemaining > EXPIRY_THRESHOLD_MILLES) {
            return stored;
          }
        }
      } catch {
        // Storage flaky (SW not ready). Fall through to doRefresh().
      }
    }

    // De-dupe concurrent refresh callers so rotating-refresh-token IdPs
    // don't see two racing /auth/refresh calls.
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
    // Capture the renewer's result outside the try/catch. If publish (the
    // strict persist) throws AFTER renewer succeeds, we still hold a valid
    // token in memory; the current tab must stay authenticated for the rest
    // of its session rather than emit `refresh-failed` and sign the user
    // out. Only the durability across reload is lost, and CrossTabLock's
    // own try/catch already broadcasts `failed` for followers to retry.
    // Greptile P1 (r4039793087).
    let renewedResult: RenewResult | undefined;
    let outcome;
    try {
      // Persist + broadcast under the same lock the renewer holds. If we
      // released the lock first and only THEN awaited setOidcToken +
      // notifyDone, a second tab whose `ifAvailable:true` probe landed in
      // that gap would acquire the freed lock and call renewer() again —
      // and with IdPs that rotate refresh tokens on use (Auth0, some OIDC
      // providers), the duplicate call would consume the just-rotated
      // token and invalidate the first tab's fresh session. See the
      // greptile P1 finding and the docblock on
      // `CrossTabLock.runExclusive`.
      outcome = await this.lock.runExclusive<RenewResult>(
        async () => {
          const result = await renewer();
          renewedResult = result;

          return result;
        },
        {
          publish: async (result) => {
            // Persist BEFORE broadcasting so a sibling tab that immediately
            // reads storage can never observe the old expired token behind
            // a fresh `done`. Use the strict variant so a silent-write
            // failure (private-browsing IndexedDB, quota, SW crash) throws
            // out of `publish` — the try/catch in
            // `CrossTabLock.runExclusive` then broadcasts `failed` under
            // the same lock hold, and followers retry through the lock
            // instead of trusting an unpersisted `done` payload the next
            // cold-load would see stale storage behind. Greptile P1
            // (r4035047159).
            await setOidcTokenStrict(result.idToken);
            this.lock.notifyDone(result);
          },
        }
      );
    } catch (err) {
      return this.handleLeaderPathError(err, renewer, attempt, renewedResult);
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
      this.bus.emit(REFRESH_FAILED_EVENT, { reason });

      throw new Error(reason);
    }

    // Persistence + notify already ran under the lock via the `publish`
    // hook above; here we only wire the coordinator-side side-effects
    // (emit `refreshed`, schedule the proactive timer).
    return this.applyRefreshed(outcome.value);
  }

  // Extracted from `runExclusiveRefresh` to keep its cyclomatic complexity
  // under the project's sonarjs ceiling — the three-way classification
  // (retryable follower timeout / persist-only failure with token in hand /
  // real renewer failure) is meaningful and worth reading on its own.
  private async handleLeaderPathError(
    err: unknown,
    renewer: Renewer,
    attempt: number,
    renewedResult: RenewResult | undefined
  ): Promise<string> {
    // Follower timed out waiting for the leader (slow IdP, leader tab
    // closed mid-refresh, missed broadcast). Retry through the lock so
    // any other follower that also fell back races us for the exclusive
    // slot instead of running its own renewer in parallel.
    if (err instanceof LockTimeoutError && attempt < MAX_RECOVERY_ATTEMPTS) {
      return this.runExclusiveRefresh(renewer, attempt + 1);
    }
    // Renewer succeeded but the persist/broadcast step threw — the
    // strict-write path keeps the fresh token in `inMemoryState` so
    // `getOidcToken` in this tab still returns it. Apply the refresh
    // locally so this tab stays authenticated for its session, rather
    // than signing the user out because a sibling tab won't survive
    // reload. Followers already got `failed` via CrossTabLock's own
    // try/catch and will retry through the lock.
    if (renewedResult) {
      return this.applyRefreshed(renewedResult);
    }
    // Leader's own renewer threw. `runExclusive` already broadcast
    // `failed` to followers; propagate the failure here. Also the
    // bounded-retry give-up path: emit `refresh-failed` so downstream
    // consumers (interceptors, the queue drain) see the same signal.
    const reason = err instanceof Error ? err.message : String(err);
    this.bus.emit(REFRESH_FAILED_EVENT, { reason });

    throw err;
  }

  private applyRefreshed(result: RenewResult): string {
    this.lastMintedToken = result.idToken;
    this.bus.emit('refreshed', {
      expiresAt: result.expiresAt,
      idToken: result.idToken,
    });
    this.timer.schedule(result.expiresAt, () => {
      this.ensureFreshToken().catch(() => undefined);
    });

    return result.idToken;
  }

  // Only count a cycle when the failing request carried the
  // most-recently minted token — a genuine "the refresh didn't help"
  // signal. A 401 with an older token is an in-flight straggler that
  // predates a refresh (this tab's OR a sibling tab's — the
  // cross-tab BroadcastChannel keeps `lastMintedToken` in sync so a
  // sibling-minted token still counts here). Also skip on concurrent
  // 401s during one in-flight refresh so they share the entry.
  private shouldCountNewCycle(config: unknown): boolean {
    if (this.inflight) {
      return false;
    }
    if (this.lastMintedToken === null) {
      return true;
    }

    return this.extractBearer(config) === this.lastMintedToken;
  }

  // Returns true if the breaker just tripped (caller should throw).
  private recordCycleAndCheckBreaker(): boolean {
    const now = Date.now();
    this.refreshCycleTimestamps = this.refreshCycleTimestamps.filter(
      (t) => now - t < REFRESH_WINDOW_MS
    );
    this.refreshCycleTimestamps.push(now);
    if (this.refreshCycleTimestamps.length > MAX_REFRESH_CYCLES_PER_WINDOW) {
      this.bus.emit(REFRESH_FAILED_EVENT, {
        reason: `Auth refresh loop circuit-breaker tripped: > ${MAX_REFRESH_CYCLES_PER_WINDOW} cycles in ${REFRESH_WINDOW_MS}ms`,
      });

      return true;
    }

    return false;
  }

  private extractIdToken(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const token = (payload as { idToken?: unknown }).idToken;

    return typeof token === 'string' && token.length > 0 ? token : null;
  }

  private extractBearer(config: unknown): string | null {
    const headers = (
      config as { headers?: Record<string, unknown> } | undefined
    )?.headers;
    const raw = headers?.Authorization ?? headers?.authorization;
    if (typeof raw !== 'string') {
      return null;
    }
    const match = /^Bearer\s+(.+)$/i.exec(raw);

    return match ? match[1] : null;
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

  private async pumpQueue(
    axios: AxiosInstance,
    options: { force?: boolean } = {}
  ): Promise<void> {
    try {
      const token = await this.ensureFreshToken(options);
      await this.queue.drain(token, axios);
    } catch {
      await this.queue.drain(null, axios);
    }
  }
}

export const authCoordinator = new AuthCoordinator();
