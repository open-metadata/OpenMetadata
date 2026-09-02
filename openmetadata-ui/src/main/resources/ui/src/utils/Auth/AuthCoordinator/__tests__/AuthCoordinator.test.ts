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

jest.mock('../../../SwTokenStorageUtils', () => ({
  clearOidcToken: jest.fn(),
  getOidcToken: jest.fn(() => 'stale-token'),
  setOidcToken: jest.fn(),
}));

jest.mock('../../../AuthProvider.util', () => ({
  EXPIRY_THRESHOLD_MILLES: 60_000,
  extractDetailsFromToken: jest.fn(),
}));

// The doRefresh cross-tab paths (leader `done` payload / `failed` / lock
// timeout → doLocalRefresh) need CrossTabLock.runExclusive to return a
// chosen outcome per test. Rather than mocking the whole module (which
// runs into a factory-hoist TDZ vs the module-level `new AuthCoordinator`
// singleton at the bottom of AuthCoordinator.ts), swap the fields on the
// coordinator's own lock instance after construction. TypeScript's
// `private` is a type-level fence only — the runtime property is normal.
import { LockTimeoutError } from '../CrossTabLock';

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
  const axios = {
    interceptors: {
      response: {
        use: (
          _fulfilled: (value: unknown) => unknown,
          rejected: (error: unknown) => Promise<unknown>
        ) => {
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
  };
};

describe('AuthCoordinator', () => {
  let coordinator: AuthCoordinator;

  beforeEach(() => {
    coordinator = new AuthCoordinator();
    installLockMock(coordinator);
    // Default the cross-tab lock to the leader path so existing tests that
    // don't care about follower behavior see runExclusive run their work
    // and hand back {role:'leader'}.
    mockRunExclusive.mockImplementation(async (work) => ({
      role: 'leader',
      value: await work(),
    }));
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
    jest.useFakeTimers();
    try {
      const pending = coordinator.ensureFreshToken();
      const expectation = expect(pending).rejects.toThrow(/no renewer/i);

      jest.advanceTimersByTime(5_000);
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

    const error = {
      response: { status: 401, data: {} },
      config: { url: '/api/v1/tables' },
    };

    // Three concurrent 401s land while the same refresh cycle is in flight.
    triggerError(error);
    triggerError(error);
    triggerError(error);

    expect(onRefreshStart).toHaveBeenCalledTimes(1);

    resolveRenewer({ expiresAt: Date.now() + 300_000, idToken: 'fresh' });
    await Promise.resolve();
    await Promise.resolve();
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

      jest.advanceTimersByTime(5_000);
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
      const { setOidcToken } = jest.requireMock('../../../SwTokenStorageUtils');

      await coordinator.ensureFreshToken();

      // Persist must happen before the broadcast so a sibling tab can't
      // read stale storage behind a fresh `done` (the CrossTabLock
      // P1 fix).
      const setOrder = (setOidcToken as jest.Mock).mock.invocationCallOrder[0];
      const notifyOrder = mockNotifyDone.mock.invocationCallOrder[0];

      expect(setOrder).toBeLessThan(notifyOrder);
      expect(mockNotifyDone).toHaveBeenCalledWith(payload);
    });
  });
});
