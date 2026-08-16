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
import { AuthCoordinator } from '../AuthCoordinator';

jest.mock('../../../SwTokenStorageUtils', () => ({
  clearOidcToken: jest.fn(),
  getOidcToken: jest.fn(() => 'stale-token'),
  setOidcToken: jest.fn(),
}));

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
});
