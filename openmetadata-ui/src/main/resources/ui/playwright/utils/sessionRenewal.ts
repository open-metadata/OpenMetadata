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

// Both refresh handlers resolve the session via acquireRefreshLease, which reads
// OM_SESSION; JSESSIONID is only the Jetty session used on the login leg.
export const SESSION_COOKIE_NAME = 'OM_SESSION';

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

/** Seconds, no schema minimum, and governs OM's own JWT rather than the IdP's. */
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

/**
 * Caps the number of concurrent server-side sessions a single user may hold;
 * exceeding it revokes the least-recently-used session. Top-level on
 * authenticationConfiguration, unlike the nested token-validity overrides above.
 */
export const withMaxActiveSessions = (
  base: ProviderConfigOverride,
  maxActiveSessions: number
): ProviderConfigOverride => ({
  ...base,
  authenticationConfiguration: {
    ...base.authenticationConfiguration,
    maxActiveSessionsPerUser: maxActiveSessions,
  },
});

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

/** Makes the next refresh fail with 401 "No active session". */
export const clearServerSessionCookie = async (
  context: BrowserContext
): Promise<void> => {
  await context.clearCookies({ name: SESSION_COOKIE_NAME });
};

/**
 * Expires OM's stored token in place, for providers whose real token lifetime we
 * cannot shorten. Writes through the Service Worker because getOidcToken() reads
 * the SW's in-memory cache, so an IndexedDB write alone would not be seen.
 */
export const expireStoredToken = async (
  page: Page,
  claims: Record<string, unknown> = {}
): Promise<string> => {
  // clients.claim() is async, so controller can still be null right after load.
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
