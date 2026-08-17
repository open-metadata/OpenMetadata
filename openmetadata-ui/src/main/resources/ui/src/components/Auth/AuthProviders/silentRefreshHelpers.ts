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
import { REFRESHABLE_AUTH_ERRORS } from '../../../constants/Auth.constants';

/**
 * Silent-refresh helpers pulled out of AuthProvider for direct unit
 * testing. Every helper here is pure or takes its component-scoped
 * dependencies as parameters so tests can exercise the same code paths
 * that ship, without depending on the AuthProvider mount lifecycle.
 */

/**
 * True when the axios error is a 401 whose body message matches one of
 * the strings the server sends for a refreshable auth failure
 * (`Expired token!`, `Token signing key not found`).
 *
 * Used to decide whether a caught /users/loggedInUser 401 is worth
 * retrying after the authenticator's renewer has had a chance to
 * register on TokenService.
 */
export const isRefreshableAuthError = (err: AxiosError): boolean => {
  const message = (err.response?.data as { message?: string })?.message ?? '';

  return (
    err.response?.status === 401 &&
    REFRESHABLE_AUTH_ERRORS.some((authError) => message.includes(authError))
  );
};

/**
 * Poll `getRenewToken()` until it returns a function or the timeout
 * elapses. The lazy authenticator wrappers (MSAL / Okta / Auth0 /
 * OIDC / Basic / Generic) register `renewToken` on the shared
 * `TokenService` singleton via a mount effect that races the cold-load
 * `getLoggedInUserDetails` call — waiting here lets the proactive
 * refresh happen at the right moment instead of firing before the
 * renewer is available and being silently no-op'd by
 * `TokenService.fetchNewToken`.
 *
 * Returns true once a function is observed, false on timeout.
 */
export const waitForRenewerReady = async (
  getRenewToken: () => unknown,
  maxWaitMs = 2000,
  pollMs = 100
): Promise<boolean> => {
  const start = Date.now();
  while (
    typeof getRenewToken() !== 'function' &&
    Date.now() - start < maxWaitMs
  ) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return typeof getRenewToken() === 'function';
};

export interface EnsureFreshTokenDeps {
  getOidcToken: () => Promise<string | undefined>;
  // Accepts any object with an `isExpired`-shaped field so this helper works
  // with `extractDetailsFromToken`, whose return type widens to `boolean | 0`
  // for the JWT `exp && dateNow >= exp * 1000` expression.
  extractExpiry: (token: string) => { isExpired: unknown };
  getRenewToken: () => unknown;
  refreshToken: () => Promise<unknown>;
  renewerWaitMs?: number;
}

/**
 * Best-effort proactive refresh before the /users/loggedInUser call
 * on mount. If the stored token is already expired, wait briefly for
 * the authenticator's renewer to become available and trigger a
 * refresh — this prevents the axios interceptor from racing the
 * renewer registration and force-logging the user out.
 *
 * INTENTIONALLY BEST-EFFORT: on any failure (renewer never registers,
 * refresh throws, refresh returns falsy) the function resolves without
 * signalling failure. The caller then issues the /loggedInUser request
 * normally and lets the axios interceptor + catch-block retry handle a
 * real 401. A hard failure here would call resetUserDetails() and
 * discard valid refresh credentials on merely-slow lazy-load — worse
 * than the bug this helper is trying to fix.
 */
export const ensureFreshTokenBeforeUserFetch = async (
  deps: EnsureFreshTokenDeps
): Promise<void> => {
  const currentToken = await deps.getOidcToken();
  if (!currentToken) {
    return;
  }
  const { isExpired } = deps.extractExpiry(currentToken);
  if (!isExpired) {
    return;
  }
  const renewerReady = await waitForRenewerReady(
    deps.getRenewToken,
    deps.renewerWaitMs
  );
  if (!renewerReady) {
    return;
  }
  try {
    await deps.refreshToken();
  } catch {
    // best-effort — swallow and let the caller proceed
  }
};
