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
import { BrowserContext, Page } from '@playwright/test';
import { ProviderConfigOverride } from './ssoAuth';
import { APP_STATE_KEY, OIDC_TOKEN_KEY } from './tokenStorage';

export const SHORT_ACCESS_TTL_SECONDS = 30;

// OpenMetadata's server-side session cookie (SessionCookieUtil.COOKIE_NAME).
// Both refresh handlers — SamlAuthServletHandler.handleRefresh and
// AuthenticationCodeFlowHandler.handleRefresh — resolve the session through
// SessionService.acquireRefreshLease, which reads OM_SESSION. Clearing it makes
// refresh return 401 {"error":"No active session"}.
//
// This was previously JSESSIONID, which is the Jetty HttpSession the OneLogin
// SAML library needs on the *login* leg and is not consulted on refresh at all,
// so clearing it did not force the 401 the renewal suite intends.
export const SESSION_COOKIE_NAME = 'OM_SESSION';

// The /auth/refresh endpoint is auth-provider-agnostic on the server —
// AuthServeletHandlerRegistry dispatches to SamlAuthServletHandler for SAML,
// BasicAuthServletHandler for basic, etc. The UI always calls this path.
export const AUTH_REFRESH_PATH = '/api/v1/auth/refresh';

export const withShortSamlTokenValidity = (
  base: ProviderConfigOverride,
  tokenValiditySeconds: number = SHORT_ACCESS_TTL_SECONDS
): ProviderConfigOverride => {
  const samlConfig =
    (base.authenticationConfiguration.samlConfiguration as
      | Record<string, unknown>
      | undefined) ?? {};
  const security =
    (samlConfig.security as Record<string, unknown> | undefined) ?? {};

  return {
    ...base,
    authenticationConfiguration: {
      ...base.authenticationConfiguration,
      samlConfiguration: {
        ...samlConfig,
        security: {
          ...security,
          tokenValidity: tokenValiditySeconds,
        },
      },
    },
  };
};

/**
 * Confidential-OIDC analogue of `withShortSamlTokenValidity`.
 *
 * `oidcConfiguration.tokenValidity` (seconds, schema default 3600, no minimum)
 * is what AuthenticationCodeFlowHandler passes to JWTTokenGenerator for every
 * OpenMetadata JWT it mints — on callback and on refresh. Shortening it is
 * tenant-safe: it governs OpenMetadata's own token, not anything the IdP issues.
 */
export const withShortOidcTokenValidity = (
  base: ProviderConfigOverride,
  tokenValiditySeconds: number = SHORT_ACCESS_TTL_SECONDS
): ProviderConfigOverride => {
  const oidcConfig =
    (base.authenticationConfiguration.oidcConfiguration as
      | Record<string, unknown>
      | undefined) ?? {};

  return {
    ...base,
    authenticationConfiguration: {
      ...base.authenticationConfiguration,
      oidcConfiguration: {
        ...oidcConfig,
        tokenValidity: tokenValiditySeconds,
      },
    },
  };
};

export const decodeJwtExp = (jwt: string): number => {
  const payload = jwt.split('.')[1];

  if (!payload) {
    throw new Error('Malformed JWT: missing payload segment');
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '='
  );
  const decoded = Buffer.from(padded, 'base64').toString('utf8');

  return (JSON.parse(decoded) as { exp: number }).exp;
};

export const waitForAccessTokenExpiry = async (
  ttlSeconds: number = SHORT_ACCESS_TTL_SECONDS,
  bufferSeconds: number = 2
): Promise<void> => {
  await new Promise((resolve) =>
    setTimeout(resolve, (ttlSeconds + bufferSeconds) * 1000)
  );
};

/**
 * Drops OpenMetadata's server-side session cookie so the next refresh cannot
 * resolve a session. Applies to any provider whose refresh goes through
 * OpenMetadata (SAML and confidential OIDC alike), not just SAML.
 */
export const clearServerSessionCookie = async (
  context: BrowserContext
): Promise<void> => {
  await context.clearCookies({ name: SESSION_COOKIE_NAME });
};

/**
 * Replaces OpenMetadata's stored access token with a well-formed but
 * already-expired JWT, so the app's renewal path runs immediately instead of
 * waiting for the real token to age out.
 *
 * Needed for providers whose token lifetime OpenMetadata cannot shorten — a
 * public-client Okta tenant sets its own ID/access token TTLs, so
 * `withShortSamlTokenValidity` + `waitForAccessTokenExpiry` have no equivalent.
 *
 * The write goes through the Service Worker rather than IndexedDB directly:
 * `getOidcToken()` reads the SW's in-memory cache, so a direct IndexedDB write
 * would leave the running app still holding the live token.
 *
 * Returns the forged JWT so callers can assert that it was replaced.
 */
export const expireStoredToken = async (
  page: Page,
  claims: Record<string, unknown> = {}
): Promise<string> => {
  // app-worker.js calls skipWaiting() + clients.claim(), but claiming is still
  // async — on a freshly created context the worker can be installed while
  // navigator.serviceWorker.controller is briefly null, which would make the
  // write below reject outright.
  await page.waitForFunction(
    () => Boolean(navigator.serviceWorker?.controller),
    undefined,
    { timeout: 30_000 }
  );

  return page.evaluate(
    ({ appStateKey, oidcTokenKey, tokenClaims }) =>
      new Promise<string>((resolve, reject) => {
        const toBase64Url = (payload: Record<string, unknown>) =>
          btoa(JSON.stringify(payload))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        const expiredJwt = [
          toBase64Url({ alg: 'RS256', typ: 'JWT' }),
          toBase64Url({
            ...tokenClaims,
            exp: Math.floor(Date.now() / 1000) - 3600,
          }),
          'expired-by-playwright',
        ].join('.');

        const controller = navigator.serviceWorker.controller;

        if (!controller) {
          reject(new Error('No active Service Worker controller'));

          return;
        }

        const readChannel = new MessageChannel();

        readChannel.port1.onmessage = (event) => {
          const state = event.data.result ? JSON.parse(event.data.result) : {};

          state[oidcTokenKey] = expiredJwt;

          const writeChannel = new MessageChannel();

          writeChannel.port1.onmessage = () => resolve(expiredJwt);
          controller.postMessage(
            { type: 'set', key: appStateKey, value: JSON.stringify(state) },
            [writeChannel.port2]
          );
        };
        controller.postMessage({ type: 'get', key: appStateKey }, [
          readChannel.port2,
        ]);
      }),
    {
      appStateKey: APP_STATE_KEY,
      oidcTokenKey: OIDC_TOKEN_KEY,
      tokenClaims: claims,
    }
  );
};
