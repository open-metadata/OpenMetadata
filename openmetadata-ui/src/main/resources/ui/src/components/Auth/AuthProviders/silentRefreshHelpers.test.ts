/*
 *  Copyright 2025 Collate.
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

import { AxiosError } from 'axios';
import {
  ensureFreshTokenBeforeUserFetch,
  isRefreshableAuthError,
  waitForRenewerReady,
} from './silentRefreshHelpers';

// This repo enables Jest fake timers globally via jest.config.js
// (`fakeTimers.enableGlobally: true`). The waitForRenewerReady poll loop
// uses real setTimeout, so opt into real timers for this suite.
beforeEach(() => {
  jest.useRealTimers();
});

afterEach(() => {
  jest.useFakeTimers();
});

const buildAxiosError = (
  status: number | undefined,
  message: string | undefined
): AxiosError =>
  ({
    response: {
      status,
      data: message === undefined ? undefined : { message },
    },
  } as unknown as AxiosError);

describe('isRefreshableAuthError', () => {
  it('returns true for 401 with "Expired token!" in the message', () => {
    expect(
      isRefreshableAuthError(
        buildAxiosError(401, 'Not Authorized! Expired token!')
      )
    ).toBe(true);
  });

  it('returns true for 401 with "Token signing key not found" in the message', () => {
    expect(
      isRefreshableAuthError(
        buildAxiosError(
          401,
          'Not Authorized! Token signing key not found in configured public keys'
        )
      )
    ).toBe(true);
  });

  it('returns false for a 401 with an unrelated message', () => {
    expect(
      isRefreshableAuthError(buildAxiosError(401, 'Some other server error'))
    ).toBe(false);
  });

  it('returns false for a non-401 with a refreshable-looking message', () => {
    expect(isRefreshableAuthError(buildAxiosError(500, 'Expired token!'))).toBe(
      false
    );
  });

  it('returns false when the response has no message field', () => {
    expect(isRefreshableAuthError(buildAxiosError(401, undefined))).toBe(false);
  });
});

describe('waitForRenewerReady', () => {
  it('resolves to true immediately when the renewer is already a function', async () => {
    const start = Date.now();
    const ready = await waitForRenewerReady(() => jest.fn(), 1000, 50);

    expect(ready).toBe(true);
    // Should not have waited a full poll cycle when the renewer is ready
    // synchronously.
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('resolves to true once the renewer becomes a function within the wait window', async () => {
    let attempts = 0;
    const getRenewToken = () => {
      attempts += 1;

      return attempts >= 3 ? jest.fn() : null;
    };
    const ready = await waitForRenewerReady(getRenewToken, 1000, 20);

    expect(ready).toBe(true);
    expect(attempts).toBeGreaterThanOrEqual(3);
  });

  it('resolves to false when the renewer never becomes a function within the timeout', async () => {
    const ready = await waitForRenewerReady(() => null, 100, 20);

    expect(ready).toBe(false);
  });

  it('treats a non-function value (object, string, undefined) as not-ready', async () => {
    // Regression: `typeof null` is 'object' — the check must be `=== 'function'`.
    const ready = await waitForRenewerReady(() => ({}), 60, 20);

    expect(ready).toBe(false);
  });
});

describe('ensureFreshTokenBeforeUserFetch', () => {
  const buildDeps = (overrides: Record<string, unknown> = {}) => ({
    getOidcToken: jest.fn().mockResolvedValue('some-token'),
    extractExpiry: jest.fn().mockReturnValue({ isExpired: false }),
    getRenewToken: jest.fn().mockReturnValue(jest.fn()),
    refreshToken: jest.fn().mockResolvedValue('fresh-token'),
    renewerWaitMs: 100,
    ...overrides,
  });

  it('is a no-op when no stored token exists', async () => {
    const deps = buildDeps({
      getOidcToken: jest.fn().mockResolvedValue(undefined),
    });
    await ensureFreshTokenBeforeUserFetch(deps);

    expect(deps.extractExpiry).not.toHaveBeenCalled();
    expect(deps.refreshToken).not.toHaveBeenCalled();
  });

  it('is a no-op when the stored token is still valid', async () => {
    const deps = buildDeps({
      extractExpiry: jest.fn().mockReturnValue({ isExpired: false }),
    });
    await ensureFreshTokenBeforeUserFetch(deps);

    expect(deps.getRenewToken).not.toHaveBeenCalled();
    expect(deps.refreshToken).not.toHaveBeenCalled();
  });

  it('proactively refreshes when the stored token is expired and the renewer is ready', async () => {
    const deps = buildDeps({
      extractExpiry: jest.fn().mockReturnValue({ isExpired: true }),
    });
    await ensureFreshTokenBeforeUserFetch(deps);

    expect(deps.refreshToken).toHaveBeenCalledTimes(1);
  });

  it('resolves silently (does NOT throw) when the renewer never registers — best-effort semantics', async () => {
    // Regression against Greptile P1: hard failure here would trigger
    // resetUserDetails() in AuthProvider and destroy valid refresh
    // credentials on merely-slow lazy authenticator load. This test
    // pins the best-effort contract.
    const deps = buildDeps({
      extractExpiry: jest.fn().mockReturnValue({ isExpired: true }),
      getRenewToken: jest.fn().mockReturnValue(null),
      renewerWaitMs: 40,
    });

    await expect(
      ensureFreshTokenBeforeUserFetch(deps)
    ).resolves.toBeUndefined();
    expect(deps.refreshToken).not.toHaveBeenCalled();
  });

  it('resolves silently when refreshToken itself throws', async () => {
    const deps = buildDeps({
      extractExpiry: jest.fn().mockReturnValue({ isExpired: true }),
      refreshToken: jest.fn().mockRejectedValue(new Error('network down')),
    });

    await expect(
      ensureFreshTokenBeforeUserFetch(deps)
    ).resolves.toBeUndefined();
    expect(deps.refreshToken).toHaveBeenCalledTimes(1);
  });
});
