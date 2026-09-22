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
import { extractDetailsFromToken } from '../../../AuthProvider.util';
import { getOidcToken } from '../../../SwTokenStorageUtils';
import { AuthCoordinator } from '../AuthCoordinator';
import { LockTimeoutError } from '../CrossTabLock';

jest.mock('../../../SwTokenStorageUtils', () => ({
  clearOidcToken: jest.fn(),
  getOidcToken: jest.fn(() => 'stale-token'),
  setOidcToken: jest.fn(),
  setOidcTokenStrict: jest.fn(),
}));

jest.mock('../../../AuthProvider.util', () => ({
  EXPIRY_THRESHOLD_MILLES: 60_000,
  extractDetailsFromToken: jest.fn(),
}));

// The doRefresh cross-tab paths (leader `done` payload / `failed` / lock
// timeout → doLocalRefresh) need CrossTabLock.runExclusive to return a
// chosen outcome per test. Rather than mocking the whole CrossTabLock
// module (which runs into a factory-hoist TDZ vs the module-level
// `new AuthCoordinator` singleton at the bottom of AuthCoordinator.ts),
// swap the fields on the coordinator's own lock instance after construction.
// TypeScript's `private` is a type-level fence only — the runtime property
// is normal. `LockTimeoutError` is a plain class so importing it above
// alongside the other module imports does not trigger the same TDZ hazard
// (organize-imports-cli hoists all imports to the top anyway).
const mockRunExclusive = jest.fn();
const mockNotifyDone = jest.fn();
const mockNotifyFailed = jest.fn();

const installLockMock = (coord: AuthCoordinator) => {
  const lock = (coord as unknown as { lock: Record<string, unknown> }).lock;
  lock.runExclusive = mockRunExclusive;
  lock.notifyDone = mockNotifyDone;
  lock.notifyFailed = mockNotifyFailed;
};

const mockedGetOidcToken = getOidcToken as jest.MockedFunction<
  typeof getOidcToken
>;
const mockedExtractDetailsFromToken =
  extractDetailsFromToken as jest.MockedFunction<
    typeof extractDetailsFromToken
  >;

// Fires a visibilitychange event with document.visibilityState = 'visible'.
// AuthCoordinator's VisibilityWatcher listens for this to gate refresh on
// storage freshness. Returns after microtasks flush so onTabVisible has
// resolved its async chain.
const triggerTabFocus = async () => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  document.dispatchEvent(new Event('visibilitychange'));
  // Two flushes: onTabVisible awaits getOidcToken, then dispatches the
  // conditional branch; give both microtask ticks a chance to run.
  await Promise.resolve();
  await Promise.resolve();
};

// Minimal axios stand-in: exposes the `rejected` handler registered via
// `interceptors.response.use` so tests can simulate a 401 without a real
// HTTP round trip.
const createMockAxios = () => {
  let rejectedHandler: ((error: unknown) => Promise<unknown>) | null = null;
  let fulfilledHandler: ((value: unknown) => unknown) | null = null;
  const axios = {
    interceptors: {
      response: {
        use: (
          fulfilled: (value: unknown) => unknown,
          rejected: (error: unknown) => Promise<unknown>
        ) => {
          fulfilledHandler = fulfilled;
          rejectedHandler = rejected;

          return 1;
        },
        eject: jest.fn(),
      },
    },
    request: jest.fn(async () => ({ data: 'ok' })),
  } as unknown as AxiosInstance;

  return {
    axios,
    triggerError: (error: unknown) => rejectedHandler?.(error),
    triggerSuccess: (response: unknown = { status: 200, data: {} }) =>
      fulfilledHandler?.(response),
  };
};

describe('AuthCoordinator', () => {
  let coordinator: AuthCoordinator;

  beforeEach(() => {
    coordinator = new AuthCoordinator();
    installLockMock(coordinator);
    // Default the cross-tab lock to the leader path so existing tests that
    // don't care about follower behavior see runExclusive run their work
    // and hand back {role:'leader'}. The real runExclusive also invokes
    // the caller's `publish` hook under the lock (see the CrossTabLock P1
    // fix that folds `setOidcToken` + `notifyDone` inside the lock hold
    // to prevent duplicate-leader renewals with rotating refresh tokens);
    // the mock has to mirror that or the leader-path assertions on
    // `setOidcToken` / `notifyDone` never fire.
    mockRunExclusive.mockImplementation(async (work, options) => {
      const value = await work();
      if (options?.publish) {
        await options.publish(value);
      }

      return { role: 'leader', value };
    });
    mockNotifyDone.mockClear();
    mockNotifyFailed.mockClear();
  });

  afterEach(() => coordinator.dispose());

  it('de-dupes concurrent ensureFreshToken calls into a single renewer invocation', async () => {
    const renewer = jest.fn(async () => ({
      expiresAt: Date.now() + 300_000,
      idToken: 'fresh',
    }));
    coordinator.registerRenewer(renewer);

    const [a, b, c] = await Promise.all([
      coordinator.ensureFreshToken(),
      coordinator.ensureFreshToken(),
      coordinator.ensureFreshToken(),
    ]);

    expect(renewer).toHaveBeenCalledTimes(1);
    expect([a, b, c]).toEqual(['fresh', 'fresh', 'fresh']);
  });

  it('emits refreshed on success', async () => {
    const renewer = jest.fn(async () => ({ expiresAt: 42, idToken: 'fresh' }));
    coordinator.registerRenewer(renewer);
    const events: unknown[] = [];
    coordinator.on('refreshed', (p) => events.push(p));

    await coordinator.ensureFreshToken();

    expect(events).toEqual([{ expiresAt: 42, idToken: 'fresh' }]);
  });

  it('emits refresh-failed and rejects on renewer error', async () => {
    coordinator.registerRenewer(async () => {
      throw new Error('boom');
    });
    const failures: unknown[] = [];
    coordinator.on('refresh-failed', (p) => failures.push(p));

    await expect(coordinator.ensureFreshToken()).rejects.toThrow('boom');

    expect(failures).toEqual([{ reason: 'boom' }]);
  });

  it('rejects when no renewer is registered', async () => {
    // No renewer ever registers, so ensureFreshToken now waits out the
    // renewer-registration timeout (see the dedicated timeout test below)
    // before rejecting — fast-forward fake timers instead of waiting 5s
    // of real time, which would race Jest's own default test timeout.
    // Uses the async timer variant so the microtask flush needed to
    // resolve the `await getOidcToken()` inside the fast-path happens
    // BEFORE the timer advance reaches the awaitRenewer setTimeout.
    jest.useFakeTimers();
    try {
      const pending = coordinator.ensureFreshToken();
      const expectation = expect(pending).rejects.toThrow(/no renewer/i);

      // advanceTimersByTimeAsync (Jest 29+) flushes microtasks between ticks —
      // the sync variant leaves the fast-path's `await getOidcToken()` promise
      // unsettled, so awaitRenewer's setTimeout is never armed. Cast because
      // the project's `@types/jest` predates that method's declaration.
      await (
        jest as unknown as {
          advanceTimersByTimeAsync: (ms: number) => Promise<void>;
        }
      ).advanceTimersByTimeAsync(5_000);
      await expectation;
    } finally {
      jest.useRealTimers();
    }
  });

  it('fires the install() onRefreshStart callback exactly once per refresh cycle for concurrent 401s', async () => {
    // The renewer's promise executor runs synchronously, so `resolveRenewer`
    // is assigned before this function returns — safe to assert non-null.
    let resolveRenewer!: (result: {
      expiresAt: number;
      idToken: string;
    }) => void;
    const renewalPromise = new Promise<{ expiresAt: number; idToken: string }>(
      (resolve) => {
        resolveRenewer = resolve;
      }
    );
    const renewer = jest.fn(() => renewalPromise);
    coordinator.registerRenewer(renewer);
    const onRefreshStart = jest.fn();
    const isRefreshable = jest.fn(() => true);
    const { axios, triggerError } = createMockAxios();

    coordinator.install(axios, isRefreshable, onRefreshStart);

    // Distinct config objects per triggerError — real axios always
    // constructs a fresh config per request, so the per-request retry
    // counter is per-request; sharing one config across three triggers
    // would erroneously look like a triple-retry of the same request
    // and trip the per-request cap (which lives above onRefreshStart).
    const mkError = () => ({
      response: { status: 401, data: {} },
      config: { url: '/api/v1/tables' },
    });

    // Three concurrent 401s land while the same refresh cycle is in flight.
    triggerError(mkError());
    triggerError(mkError());
    triggerError(mkError());

    expect(onRefreshStart).toHaveBeenCalledTimes(1);

    resolveRenewer({ expiresAt: Date.now() + 300_000, idToken: 'fresh' });
    await Promise.resolve();
    await Promise.resolve();
  });

  it('caps per-request retries — a single endpoint that stays 401 past MAX_PER_REQUEST_RETRIES throws without signing out', async () => {
    const renewer = jest.fn(async () => ({
      expiresAt: Date.now() + 300_000,
      idToken: 'fresh',
    }));
    coordinator.registerRenewer(renewer);
    const failures: unknown[] = [];
    coordinator.on('refresh-failed', (p) => failures.push(p));
    const { axios, triggerError } = createMockAxios();
    coordinator.install(axios, () => true);
    const config = { url: '/api/v1/tables' };
    const error = { response: { status: 401, data: {} }, config };

    triggerError(error);
    await Promise.resolve();
    triggerError(error);
    await Promise.resolve();

    await expect(triggerError(error)).rejects.toBe(error);
    // A single misbehaving endpoint must not sign the whole app out —
    // that's the sliding-window breaker's job when the storm is global.
    expect(failures).toHaveLength(0);
  });

  it('circuit-breaks when > MAX_REFRESH_CYCLES_PER_WINDOW cycles fire inside the sliding window', async () => {
    const renewer = jest.fn(async () => ({
      expiresAt: Date.now() + 300_000,
      idToken: 'fresh',
    }));
    coordinator.registerRenewer(renewer);
    const failures: unknown[] = [];
    coordinator.on('refresh-failed', (p) => failures.push(p));
    const { axios, triggerError } = createMockAxios();
    coordinator.install(axios, () => true);

    // Distinct config per error to avoid the per-request cap tripping
    // first. Bearer=`fresh` matches what the renewer above mints so
    // every failure looks like "the just-minted token is still being
    // rejected" — the exact refresh-loop signal cycles should count.
    const mkError = (path: string) => ({
      response: { status: 401, data: {} },
      config: {
        headers: { Authorization: 'Bearer fresh' },
        url: `/api/v1/${path}`,
      },
    });

    for (let i = 0; i < 3; i++) {
      await triggerError(mkError(`endpoint-${i}`));
    }

    expect(failures).toEqual([]);

    await expect(triggerError(mkError('endpoint-4'))).rejects.toBeDefined();
    expect(failures).toHaveLength(1);
    expect(failures[0]).toEqual({
      reason: expect.stringMatching(/circuit-breaker tripped/),
    });
  });

  // Greptile P1 r4070169658: N requests sent with the SAME stale token
  // return 401 sequentially — each after the previous refresh has
  // completed. Without the stale-vs-minted check, each 401 would see
  // no in-flight refresh, start a new cycle, and the 4th one would
  // wrongly trip the breaker even though every refresh succeeded.
  it('does not count stragglers carrying pre-refresh tokens as cycles', async () => {
    const renewer = jest.fn(async () => ({
      expiresAt: Date.now() + 300_000,
      idToken: 'fresh',
    }));
    coordinator.registerRenewer(renewer);
    const failures: unknown[] = [];
    coordinator.on('refresh-failed', (p) => failures.push(p));
    const { axios, triggerError } = createMockAxios();
    coordinator.install(axios, () => true);

    // First 401 seeds lastMintedToken via its refresh. It has no
    // Authorization yet (nothing to compare against), so it counts as
    // the first cycle.
    await triggerError({
      config: { url: '/api/v1/first' },
      response: { status: 401, data: {} },
    });

    // Every subsequent request was sent with the OLD stale token before
    // the first refresh finished. Their 401s arrive AFTER the refresh —
    // Bearer !== the freshly-minted `fresh` — so they must retry
    // silently and not be counted as new cycles.
    for (let i = 0; i < 6; i++) {
      await triggerError({
        config: {
          headers: { Authorization: 'Bearer stale' },
          url: `/api/v1/straggler-${i}`,
        },
        response: { status: 401, data: {} },
      });
    }

    expect(failures).toEqual([]);
  });

  // Regression: a persistently-failing endpoint polled while unrelated
  // requests succeed used to slip past the "reset on 2xx" breaker.
  it('interleaved 2xx responses do NOT reset the rate-limit window', async () => {
    const renewer = jest.fn(async () => ({
      expiresAt: Date.now() + 300_000,
      idToken: 'fresh',
    }));
    coordinator.registerRenewer(renewer);
    const failures: unknown[] = [];
    coordinator.on('refresh-failed', (p) => failures.push(p));
    const { axios, triggerError, triggerSuccess } = createMockAxios();
    coordinator.install(axios, () => true);

    // Bearer=`fresh` matches the renewer's mint so each 401 is a
    // "just-minted token still rejected" signal that must count.
    for (let i = 0; i < 3; i++) {
      await triggerError({
        response: { status: 401, data: {} },
        config: {
          headers: { Authorization: 'Bearer fresh' },
          url: `/api/v1/poll-${i}`,
        },
      });
      triggerSuccess();
    }

    expect(failures).toEqual([]);

    await expect(
      triggerError({
        response: { status: 401, data: {} },
        config: {
          headers: { Authorization: 'Bearer fresh' },
          url: '/api/v1/poll-4',
        },
      })
    ).rejects.toBeDefined();
    expect(failures).toHaveLength(1);
  });

  it('concurrent 401s during a single refresh cycle share one window entry', async () => {
    let resolveRenewer!: (r: { expiresAt: number; idToken: string }) => void;
    const renewer = jest.fn(
      () =>
        new Promise<{ expiresAt: number; idToken: string }>((r) => {
          resolveRenewer = r;
        })
    );
    coordinator.registerRenewer(renewer);
    const failures: unknown[] = [];
    coordinator.on('refresh-failed', (p) => failures.push(p));
    const { axios, triggerError } = createMockAxios();
    coordinator.install(axios, () => true);

    for (let i = 0; i < 5; i++) {
      triggerError({
        response: { status: 401, data: {} },
        config: { url: `/api/v1/burst-${i}` },
      });
    }

    await Promise.resolve();
    resolveRenewer({ expiresAt: Date.now() + 300_000, idToken: 'fresh' });
    await Promise.resolve();

    expect(failures).toEqual([]);
  });

  it('does not fire onRefreshStart for a 401 that isRefreshable filters out', async () => {
    const onRefreshStart = jest.fn();
    const isRefreshable = jest.fn(() => false);
    const { axios, triggerError } = createMockAxios();

    coordinator.install(axios, isRefreshable, onRefreshStart);

    const error = {
      response: { status: 401, data: {} },
      config: { url: '/api/v1/tables' },
    };

    await expect(triggerError(error)).rejects.toBe(error);
    expect(onRefreshStart).not.toHaveBeenCalled();
  });

  it('ensureFreshToken waits for renewer registration and succeeds if registered before timeout', async () => {
    // No renewer registered yet — simulates ensureFreshToken() winning the
    // race against AuthProvider's mount effect on cold load.
    const renewer = jest.fn(async () => ({
      expiresAt: Date.now() + 300_000,
      idToken: 'fresh-from-late-renewer',
    }));

    const pending = coordinator.ensureFreshToken();

    await new Promise((resolve) => setTimeout(resolve, 50));
    coordinator.registerRenewer(renewer);

    await expect(pending).resolves.toBe('fresh-from-late-renewer');
    expect(renewer).toHaveBeenCalledTimes(1);
  });

  it('ensureFreshToken times out if renewer never registers', async () => {
    jest.useFakeTimers();
    try {
      const pending = coordinator.ensureFreshToken();
      // Attach a rejection handler synchronously so advancing fake timers
      // below can't produce an unhandled rejection before the assertion runs.
      const expectation = expect(pending).rejects.toThrow(
        /no renewer registered within timeout/i
      );

      // Async advance flushes microtasks so the fast-path's storage
      // read resolves before awaitRenewer's setTimeout is armed.
      // advanceTimersByTimeAsync (Jest 29+) flushes microtasks between ticks —
      // the sync variant leaves the fast-path's `await getOidcToken()` promise
      // unsettled, so awaitRenewer's setTimeout is never armed. Cast because
      // the project's `@types/jest` predates that method's declaration.
      await (
        jest as unknown as {
          advanceTimersByTimeAsync: (ms: number) => Promise<void>;
        }
      ).advanceTimersByTimeAsync(5_000);
      await expectation;
    } finally {
      jest.useRealTimers();
    }
  });

  // These three tests pin down the "should we refresh on tab focus?"
  // decision inside AuthCoordinator.onTabVisible. Regressing any one of
  // them re-introduces the "refresh on every tab focus" issue that was
  // explicitly flagged in review — a signed-out user should never see a
  // silent-refresh call fire just from switching tabs.
  describe('tab visibility gating', () => {
    it('does NOT call the renewer when storage has no token (signed-out user)', async () => {
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'fresh',
      }));
      coordinator.registerRenewer(renewer);
      mockedGetOidcToken.mockResolvedValueOnce('');
      const { axios } = createMockAxios();
      coordinator.install(axios, () => true);

      await triggerTabFocus();

      expect(renewer).not.toHaveBeenCalled();
      expect(mockedExtractDetailsFromToken).not.toHaveBeenCalled();
    });

    it('does NOT call the renewer when the stored token is still fresh', async () => {
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'fresh',
      }));
      coordinator.registerRenewer(renewer);
      mockedGetOidcToken.mockResolvedValueOnce('valid-jwt');
      mockedExtractDetailsFromToken.mockReturnValueOnce({
        exp: Math.floor(Date.now() / 1000) + 600, // 10 min away
        isExpired: false,
        timeoutExpiry: 540_000,
      });
      const { axios } = createMockAxios();
      coordinator.install(axios, () => true);

      await triggerTabFocus();

      expect(renewer).not.toHaveBeenCalled();
    });

    it('fires the renewer when the token is within the pre-expiry buffer (proactive refresh)', async () => {
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'fresh',
      }));
      coordinator.registerRenewer(renewer);
      mockedGetOidcToken.mockResolvedValueOnce('near-expiry-jwt');
      // 30s of lifetime left; EXPIRY_THRESHOLD_MILLES = 60s per the mock.
      mockedExtractDetailsFromToken.mockReturnValueOnce({
        exp: Math.floor(Date.now() / 1000) + 30,
        isExpired: false,
        timeoutExpiry: 0,
      });
      const { axios } = createMockAxios();
      coordinator.install(axios, () => true);

      await triggerTabFocus();
      // renewer is called via ensureFreshToken → runExclusive; give the
      // async chain a couple more ticks so the leader path resolves.
      await Promise.resolve();
      await Promise.resolve();

      expect(renewer).toHaveBeenCalledTimes(1);
    });

    it('does NOT call the renewer for an opaque / undecodable token (jwt-decode threw)', async () => {
      // extractDetailsFromToken's catch branch returns
      // {exp: 0, isExpired: true, timeoutExpiry: 0} when jwt-decode
      // throws. Naïvely ordering `if (isExpired)` first would fire the
      // renewer on every tab focus for an opaque token — the invalid-exp
      // guard must run FIRST. (Greptile P1 flagged the same ordering
      // on the sibling hotfix PR.)
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'fresh',
      }));
      coordinator.registerRenewer(renewer);
      mockedGetOidcToken.mockResolvedValueOnce('not-a-jwt');
      mockedExtractDetailsFromToken.mockReturnValueOnce({
        exp: 0,
        isExpired: true,
        timeoutExpiry: 0,
      });
      const { axios } = createMockAxios();
      coordinator.install(axios, () => true);

      await triggerTabFocus();

      expect(renewer).not.toHaveBeenCalled();
    });

    it('does NOT call the renewer when the token has no exp claim', async () => {
      // A token that decodes but lacks `exp` used to slip past the near-
      // expiry check because extractDetailsFromToken returns
      // timeoutExpiry: 0 for the missing-exp branch — same value it uses
      // for the near-expiry-buffer branch. onTabVisible must distinguish
      // "no usable expiry" from "expiry is imminent" and leave a no-exp
      // token alone (next 401 drives the refresh instead).
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'fresh',
      }));
      coordinator.registerRenewer(renewer);
      mockedGetOidcToken.mockResolvedValueOnce('no-exp-jwt');
      mockedExtractDetailsFromToken.mockReturnValueOnce({
        exp: undefined,
        isExpired: false,
        timeoutExpiry: 0,
      });
      const { axios } = createMockAxios();
      coordinator.install(axios, () => true);

      await triggerTabFocus();

      expect(renewer).not.toHaveBeenCalled();
    });

    it('fires exactly one renewer call even when the tab is re-focused rapidly during an in-flight refresh', async () => {
      // Renewer never resolves during the test so we can hammer the
      // visibility handler while the first refresh is still in flight —
      // any additional tab focuses should join the existing inflight
      // promise via ensureFreshToken()'s de-dup guard.
      const renewer = jest.fn(
        () =>
          new Promise<{ idToken: string; expiresAt: number }>(() => {
            /* never resolves */
          })
      );
      coordinator.registerRenewer(renewer);
      mockedGetOidcToken.mockResolvedValue('expired-jwt');
      mockedExtractDetailsFromToken.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) - 60, // 60s past expiry
        isExpired: true,
        timeoutExpiry: 0,
      });
      const { axios } = createMockAxios();
      coordinator.install(axios, () => true);

      await triggerTabFocus();
      await triggerTabFocus();
      await triggerTabFocus();

      expect(renewer).toHaveBeenCalledTimes(1);
    });
  });

  // These tests drive `AuthCoordinator.doRefresh` through the cross-tab
  // outcomes that CrossTabLock delivers. The lock itself is mocked so
  // each test picks its own leader/follower branch — the paths the
  // integration coverage was missing.
  describe('cross-tab refresh outcomes', () => {
    it('follower with a valid done payload applies it directly (no local renewer call)', async () => {
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'local-fresh',
      }));
      coordinator.registerRenewer(renewer);
      const leaderPayload = {
        idToken: 'leader-fresh',
        expiresAt: Date.now() + 300_000,
      };
      mockRunExclusive.mockResolvedValueOnce({
        role: 'follower',
        message: { type: 'done', payload: leaderPayload },
      });
      const refreshed: unknown[] = [];
      coordinator.on('refreshed', (p) => refreshed.push(p));

      const token = await coordinator.ensureFreshToken();

      expect(token).toBe('leader-fresh');
      expect(renewer).not.toHaveBeenCalled();
      expect(refreshed).toEqual([leaderPayload]);
    });

    it('follower on leader `failed` falls back to a local renewer call', async () => {
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'local-recovery',
      }));
      coordinator.registerRenewer(renewer);
      mockRunExclusive.mockResolvedValueOnce({
        role: 'follower',
        message: { type: 'failed', reason: 'leader IdP 5xx' },
      });
      const refreshed: unknown[] = [];
      const failures: unknown[] = [];
      coordinator.on('refreshed', (p) => refreshed.push(p));
      coordinator.on('refresh-failed', (p) => failures.push(p));

      const token = await coordinator.ensureFreshToken();

      expect(token).toBe('local-recovery');
      expect(renewer).toHaveBeenCalledTimes(1);
      expect(refreshed).toHaveLength(1);
      expect(failures).toEqual([]); // Must NOT force-logout the follower.
    });

    it('LockTimeoutError falls back to a local renewer call (no refresh-failed emitted)', async () => {
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'local-after-timeout',
      }));
      coordinator.registerRenewer(renewer);
      mockRunExclusive.mockRejectedValueOnce(new LockTimeoutError());
      const failures: unknown[] = [];
      coordinator.on('refresh-failed', (p) => failures.push(p));

      const token = await coordinator.ensureFreshToken();

      expect(token).toBe('local-after-timeout');
      expect(renewer).toHaveBeenCalledTimes(1);
      expect(failures).toEqual([]);
    });

    it('doLocalRefresh failure emits refresh-failed and rejects', async () => {
      const renewer = jest.fn(async () => {
        throw new Error('IdP unreachable');
      });
      coordinator.registerRenewer(renewer);
      // Force follower→failed path so doLocalRefresh runs and this
      // renewer throws inside it.
      mockRunExclusive.mockResolvedValueOnce({
        role: 'follower',
        message: { type: 'failed', reason: 'leader gave up' },
      });
      const failures: unknown[] = [];
      coordinator.on('refresh-failed', (p) => failures.push(p));

      await expect(coordinator.ensureFreshToken()).rejects.toThrow(
        'IdP unreachable'
      );
      expect(failures).toEqual([{ reason: 'IdP unreachable' }]);
    });

    it('follower with a `done` message but missing/invalid payload falls back to local refresh', async () => {
      // Covers the isRenewResult negative branches: the coordinator must
      // not trust a done broadcast whose payload can't be validated.
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'local-after-invalid-payload',
      }));
      coordinator.registerRenewer(renewer);
      mockRunExclusive.mockResolvedValueOnce({
        role: 'follower',
        message: { type: 'done', payload: { garbage: true } },
      });

      const token = await coordinator.ensureFreshToken();

      expect(token).toBe('local-after-invalid-payload');
      expect(renewer).toHaveBeenCalledTimes(1);
    });

    it('leader path persists token and broadcasts done with the fresh payload', async () => {
      const payload = {
        expiresAt: Date.now() + 300_000,
        idToken: 'leader-persisted',
      };
      coordinator.registerRenewer(async () => payload);
      // Default beforeEach already installs the leader-path mock;
      // just assert the side effects.
      const { setOidcTokenStrict } = jest.requireMock(
        '../../../SwTokenStorageUtils'
      );

      await coordinator.ensureFreshToken();

      // Persist must happen before the broadcast so a sibling tab can't
      // read stale storage behind a fresh `done` (the CrossTabLock
      // P1 fix).
      const setOrder = (setOidcTokenStrict as jest.Mock).mock
        .invocationCallOrder[0];
      const notifyOrder = mockNotifyDone.mock.invocationCallOrder[0];

      expect(setOrder).toBeLessThan(notifyOrder);
      expect(mockNotifyDone).toHaveBeenCalledWith(payload);
    });

    // Greptile P1 (r4035047159 + r4039793087): the fail-silent
    // `setOidcToken` used to let the leader broadcast `done` with a
    // payload no sibling tab could trust across a reload. The strict
    // variant now propagates the write error out of `publish`; the
    // `try/catch` in `CrossTabLock.runExclusive` broadcasts `failed`
    // instead, and followers retry through the lock. Crucially, though,
    // the follow-up on r4039793087 requires this leader tab to STAY
    // logged in with the fresh token — the renewer succeeded, the token
    // is in `inMemoryState` for the tab's lifetime, and only the
    // cross-reload durability was lost. `refresh-failed` must NOT fire
    // for a persist-only failure, or the interceptor and queue drain
    // would sign the user out on a transient SW hiccup even though the
    // token is perfectly valid.
    it('publish-hook storage failure keeps the tab logged in and does not emit refresh-failed', async () => {
      const payload = {
        expiresAt: Date.now() + 300_000,
        idToken: 'never-persisted',
      };
      coordinator.registerRenewer(async () => payload);
      const { setOidcTokenStrict } = jest.requireMock(
        '../../../SwTokenStorageUtils'
      );
      (setOidcTokenStrict as jest.Mock).mockRejectedValueOnce(
        new Error('IndexedDB write failed')
      );
      const failures: unknown[] = [];
      const refreshed: unknown[] = [];
      coordinator.on('refresh-failed', (p) => failures.push(p));
      coordinator.on('refreshed', (p) => refreshed.push(p));

      const token = await coordinator.ensureFreshToken();

      // Persist failed, so followers must NOT get a `done` (they'd
      // otherwise trust a payload no cold-reload can recover); the
      // CrossTabLock's own try/catch handles broadcasting `failed`.
      expect(mockNotifyDone).not.toHaveBeenCalled();
      // But the current tab keeps the renewed token in hand — the
      // in-memory fallback lives for the tab's lifetime, the queue
      // drain gets a valid token, and no sign-out is triggered.
      expect(token).toBe('never-persisted');
      expect(refreshed).toEqual([payload]);
      expect(failures).toEqual([]);
    });

    // Complements the test above and the sibling test at the top of
    // this file ('emits refresh-failed and rejects on renewer error'):
    // when the renewer itself throws (as opposed to the persist step
    // throwing after a successful renewer), the tab has no fresh token
    // in hand — the coordinator must still surface `refresh-failed` and
    // reject so the interceptor's error handler can drive sign-out. The
    // publish-hook path above is the specific case that must NOT trip
    // sign-out; this exists to keep them adjacent in the file.
    it('renewer failure still emits refresh-failed and rejects (paired with publish-hook happy-path)', async () => {
      coordinator.registerRenewer(async () => {
        throw new Error('IdP unreachable');
      });
      const failures: unknown[] = [];
      coordinator.on('refresh-failed', (p) => failures.push(p));

      await expect(coordinator.ensureFreshToken()).rejects.toThrow(
        /IdP unreachable/
      );
      expect(failures).toEqual([{ reason: 'IdP unreachable' }]);
    });
  });

  // Copilot #4: another tab may have refreshed and persisted a fresh
  // token before this tab's stale-header 401 reached ensureFreshToken().
  // The CrossTabLock only guarantees exactly-one refresh across tabs
  // per-cycle, not across time — without a pre-check the redundant tab
  // would still hit the IdP for a token already sitting in shared
  // storage. Fast-path short-circuits when the stored token's remaining
  // lifetime is safely past the pre-expiry buffer.
  describe('ensureFreshToken fast-path (skip refresh when storage is already fresh)', () => {
    it('returns the stored token without calling the renewer when it is safely fresh', async () => {
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'renewer-fresh',
      }));
      coordinator.registerRenewer(renewer);
      mockedGetOidcToken.mockResolvedValueOnce('other-tab-fresh');
      // Stored token expires 10 minutes out — well past the 60s buffer
      // the tests use (EXPIRY_THRESHOLD_MILLES mock at the top).
      mockedExtractDetailsFromToken.mockReturnValueOnce({
        exp: Math.floor(Date.now() / 1000) + 600,
        isExpired: false,
        timeoutExpiry: 600_000,
      });

      const token = await coordinator.ensureFreshToken();

      expect(token).toBe('other-tab-fresh');
      expect(renewer).not.toHaveBeenCalled();
      expect(mockRunExclusive).not.toHaveBeenCalled();
    });

    it('falls through to the full refresh when the stored token is inside the pre-expiry buffer', async () => {
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'renewer-fresh',
      }));
      coordinator.registerRenewer(renewer);
      mockedGetOidcToken.mockResolvedValueOnce('nearly-expired');
      // 30 seconds out — inside the 60s buffer, MUST refresh.
      mockedExtractDetailsFromToken.mockReturnValueOnce({
        exp: Math.floor(Date.now() / 1000) + 30,
        isExpired: false,
        timeoutExpiry: 0,
      });

      const token = await coordinator.ensureFreshToken();

      expect(token).toBe('renewer-fresh');
      expect(renewer).toHaveBeenCalledTimes(1);
    });

    it('treats an exp-less stored token (Unlimited bot JWT) as usable and skips the refresh', async () => {
      const renewer = jest.fn();
      coordinator.registerRenewer(renewer);
      mockedGetOidcToken.mockResolvedValueOnce('bot-token-no-exp');
      mockedExtractDetailsFromToken.mockReturnValueOnce({
        exp: undefined,
        isExpired: false,
        timeoutExpiry: 0,
      });

      const token = await coordinator.ensureFreshToken();

      expect(token).toBe('bot-token-no-exp');
      expect(renewer).not.toHaveBeenCalled();
    });

    it('falls through to the full refresh when the storage read itself throws', async () => {
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'renewer-fresh',
      }));
      coordinator.registerRenewer(renewer);
      mockedGetOidcToken.mockRejectedValueOnce(new Error('sw not ready'));

      const token = await coordinator.ensureFreshToken();

      expect(token).toBe('renewer-fresh');
      expect(renewer).toHaveBeenCalledTimes(1);
    });

    // Regression: server-rejected but time-fresh stored token — the
    // interceptor's `force:true` must skip the fast-path, and an
    // unforced call on the same shape must still short-circuit.
    it('force:true skips the fast-path even when the stored token is time-fresh; unforced still short-circuits', async () => {
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'renewer-fresh',
      }));
      coordinator.registerRenewer(renewer);
      mockedGetOidcToken.mockResolvedValueOnce(
        'server-rejected-but-time-fresh'
      );
      mockedExtractDetailsFromToken.mockReturnValueOnce({
        exp: Math.floor(Date.now() / 1000) + 600,
        isExpired: false,
        timeoutExpiry: 600_000,
      });

      const token = await coordinator.ensureFreshToken({ force: true });

      expect(token).toBe('renewer-fresh');
      expect(renewer).toHaveBeenCalledTimes(1);

      mockedGetOidcToken.mockResolvedValueOnce(
        'server-rejected-but-time-fresh'
      );
      mockedExtractDetailsFromToken.mockReturnValueOnce({
        exp: Math.floor(Date.now() / 1000) + 600,
        isExpired: false,
        timeoutExpiry: 600_000,
      });
      renewer.mockClear();
      const unforced = await coordinator.ensureFreshToken();

      expect(unforced).toBe('server-rejected-but-time-fresh');
      expect(renewer).not.toHaveBeenCalled();
    });
  });
});
