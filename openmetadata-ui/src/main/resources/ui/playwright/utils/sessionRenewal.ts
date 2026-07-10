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
import { BrowserContext } from '@playwright/test';
import { ProviderConfigOverride } from './ssoAuth';

export const SHORT_ACCESS_TTL_SECONDS = 30;

// Server-side SAML HttpSession cookie. SamlAuthServletHandler.handleRefresh
// uses this cookie to resolve the existing server-side session; clearing it
// prevents the session from being found and forces refresh to return 401
// "No active session".
export const SESSION_COOKIE_NAME = 'JSESSIONID';

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

export const clearSamlSessionCookie = async (
  context: BrowserContext
): Promise<void> => {
  await context.clearCookies({ name: SESSION_COOKIE_NAME });
};
