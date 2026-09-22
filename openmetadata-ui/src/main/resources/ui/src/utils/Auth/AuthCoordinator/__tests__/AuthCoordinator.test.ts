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
    // The circuit-breaker's cycle counter resets on any 2xx that passes
    // through the fulfilled interceptor; expose it so tests can simulate
    // a real success landing between two 401 cycles.
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

  // Circuit-breaker layer 1: per-request retry cap. A single request that
  // keeps 401'ing (permissions bug whose body happens to match a
  // refreshable-error string, cached response with a stale header,
  // etc.) fails deterministically for its caller rather than spinning
  // through the refresh path forever.
  it('caps per-request retries — a request that stays 401 after MAX_PER_REQUEST_RETRIES is thrown to its caller', async () => {
    const renewer = jest.fn(async () => ({
      expiresAt: Date.now() + 300_000,
      idToken: 'fresh',
    }));
    coordinator.registerRenewer(renewer);
    const { axios, triggerError } = createMockAxios();
    const isRefreshable = jest.fn(() => true);
    coordinator.install(axios, isRefreshable);
    const config = { url: '/api/v1/tables' };
    const error = { response: { status: 401, data: {} }, config };

    // First hit enqueues + triggers refresh; second hit for the same
    // config (after a refresh handed back a working token but the
    // endpoint still 401s) enqueues again. The third one exceeds the
    // per-request cap and rejects with the raw error.
    triggerError(error);
    await Promise.resolve();
    triggerError(error);
    await Promise.resolve();

    await expect(triggerError(error)).rejects.toBe(error);
  });

  // Circuit-breaker layer 2: consecutive-cycle cap. If N refresh cycles
  // fire back-to-back with no 2xx interleaved, the auth state is broken
  // beyond auto-recovery — emit `refresh-failed` (AuthProvider drives
  // sign-out) instead of continuing to spin. Every 2xx resets the
  // counter so a normal burst of stale-header 401s at cold-load doesn't
  // consume the budget a real recovery would need later.
  it('circuit-breaks after MAX_CONSECUTIVE_REFRESH_CYCLES cycles without an intervening 2xx and emits refresh-failed', async () => {
    const renewer = jest.fn(async () => ({
      expiresAt: Date.now() + 300_000,
      idToken: 'fresh',
    }));
    coordinator.registerRenewer(renewer);
    const failures: unknown[] = [];
    coordinator.on('refresh-failed', (p) => failures.push(p));
    const { axios, triggerError } = createMockAxios();
    coordinator.install(axios, () => true);

    // Each pair here uses a distinct config so the per-request retry
    // cap doesn't fire first — this test exercises layer 2, not layer 1.
    const mkError = (path: string) => ({
      response: { status: 401, data: {} },
      config: { url: `/api/v1/${path}` },
    });

    // Awaiting the pending returned by `triggerError` ensures the full
    // cycle has completed (ensureFreshToken → drain), so `inflight` is
    // back to null before the next trigger. The mock's `axios.request`
    // is a plain jest.fn (not a real axios), so drain "succeeds" from
    // its perspective but the fulfilled interceptor is never actually
    // invoked — meaning the cycle counter is NOT reset between iters,
    // which is what this test needs.
    // MAX_CONSECUTIVE_REFRESH_CYCLES=3: cycles 1..3 are tolerated;
    // cycle 4 trips the breaker → emits `refresh-failed` and throws.
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

  // Concurrent 401s during a single in-flight refresh must share one
  // cycle-counter increment. Without this, a page that fires 5 API calls
  // in parallel at cold-load and gets 5 stale-header 401s back would eat
  // the whole cycle budget in one go — the breaker would trip on the
  // very first refresh cycle even though the refresh is working fine.
  it('concurrent 401s during a single refresh cycle share one counter increment', async () => {
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

    // Fire 5 concurrent 401s WHILE the renewer is still pending — none
    // has been retried yet, so per-request caps don't fire; all should
    // share the same in-flight refresh and count as one cycle.
    for (let i = 0; i < 5; i++) {
      triggerError({
        response: { status: 401, data: {} },
        config: { url: `/api/v1/burst-${i}` },
      });
    }

    // Let the executor of the renewal promise run.
    await Promise.resolve();
    resolveRenewer({ expiresAt: Date.now() + 300_000, idToken: 'fresh' });
    await Promise.resolve();

    // 5 parallel 401s share one cycle → breaker doesn't fire (cap is 3).
    expect(failures).toEqual([]);
  });

  // Any successful 2xx on the shared axios instance resets the
  // consecutive-cycle counter — a legitimate cycle earlier in the
  // session must not eat into the budget of a real recovery later.
  it('a successful 2xx response resets the consecutive-cycle counter', async () => {
    const renewer = jest.fn(async () => ({
      expiresAt: Date.now() + 300_000,
      idToken: 'fresh',
    }));
    coordinator.registerRenewer(renewer);
    const failures: unknown[] = [];
    coordinator.on('refresh-failed', (p) => failures.push(p));
    const { axios, triggerError, triggerSuccess } = createMockAxios();
    coordinator.install(axios, () => true);

    for (let i = 0; i < 5; i++) {
      triggerError({
        response: { status: 401, data: {} },
        config: { url: `/api/v1/endpoint-${i}` },
      });
      await Promise.resolve();
      await Promise.resolve();
      // Simulate a real success response landing between refresh cycles.
      triggerSuccess();
    }

    // 5 cycles > 3 cap, but each was reset by a 2xx immediately after —
    // no circuit-break should fire.
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

    // Regression for the "endless 401 loop when the backend rotates its
    // signing key" bug. The stored token's `exp` claim is still in the
    // future, so the fast-path returned it — the axios 401 interceptor
    // retried the request with the same rejected token, got the same
    // 401 back, and looped forever without ever calling `/auth/refresh`.
    // The interceptor now calls `ensureFreshToken({ force: true })`,
    // which skips the fast-path even for time-fresh stored tokens.
    it('force:true skips the storage-freshness fast-path and drives a real refresh even when the stored token is still time-fresh', async () => {
      const renewer = jest.fn(async () => ({
        expiresAt: Date.now() + 300_000,
        idToken: 'renewer-fresh',
      }));
      coordinator.registerRenewer(renewer);
      // Stored token has a valid `exp` claim well past the 60s buffer,
      // exactly the shape a signing-key-rotation 401 has: `exp` says
      // fresh, backend says invalid.
      mockedGetOidcToken.mockResolvedValueOnce('server-rejected-but-time-fresh');
      mockedExtractDetailsFromToken.mockReturnValueOnce({
        exp: Math.floor(Date.now() / 1000) + 600,
        isExpired: false,
        timeoutExpiry: 600_000,
      });

      const token = await coordinator.ensureFreshToken({ force: true });

      expect(token).toBe('renewer-fresh');
      expect(renewer).toHaveBeenCalledTimes(1);

      // Sanity: the un-forced call on the same fixture returns the
      // stored token without calling the renewer (that's the fast-path
      // behaviour). Both call shapes coexist so the proactive-refresh
      // callers (tab-visibility, resume, timer) still get the storage
      // short-circuit they were designed for.
      mockedGetOidcToken.mockResolvedValueOnce('server-rejected-but-time-fresh');
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
