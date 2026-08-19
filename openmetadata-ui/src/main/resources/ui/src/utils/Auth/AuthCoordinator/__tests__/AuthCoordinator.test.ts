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

const mockedGetOidcToken = getOidcToken as jest.MockedFunction<
  typeof getOidcToken
>;
const mockedExtractDetailsFromToken =
  extractDetailsFromToken as jest.MockedFunction<typeof extractDetailsFromToken>;

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
});
