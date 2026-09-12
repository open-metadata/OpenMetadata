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
import { APIRequestContext, Browser, expect, Page } from '@playwright/test';
import { performAdminLogin } from './admin';
import { getApiContext, getAuthContext } from './common';

export interface ProviderCredentials {
  username: string;
  password: string;
}

export type SecurityConfigSnapshot = Record<string, unknown>;

export interface ProviderConfigOverride {
  authenticationConfiguration: Record<string, unknown>;
  authorizerConfiguration: Record<string, unknown>;
}

const SECURITY_CONFIG_ENDPOINT = '/api/v1/system/security/config';
const PERSONAL_ACCESS_TOKEN_ENDPOINT = '/api/v1/users/security/token';

// GET returns these unusable for a PUT: ldap/saml as empty-string stubs the
// validator rejects, oidc with its secret masked and nothing to unmask it.
const NON_ROUND_TRIPPABLE_AUTH_FIELDS = [
  'ldapConfiguration',
  'oidcConfiguration',
  'samlConfiguration',
] as const;

export const fetchSecurityConfig = async (
  apiContext: APIRequestContext
): Promise<SecurityConfigSnapshot> => {
  const response = await apiContext.get(SECURITY_CONFIG_ENDPOINT);

  expect(response.status()).toBe(200);

  const snapshot = (await response.json()) as SecurityConfigSnapshot;
  const authConfig = snapshot.authenticationConfiguration as
    | Record<string, unknown>
    | undefined;

  if (authConfig) {
    for (const field of NON_ROUND_TRIPPABLE_AUTH_FIELDS) {
      delete authConfig[field];
    }
  }

  return snapshot;
};

const mergeAdminPrincipals = (
  originalSection: Record<string, unknown> | undefined,
  overrideSection: Record<string, unknown>
): string[] => {
  const originalAdmins = Array.isArray(originalSection?.adminPrincipals)
    ? (originalSection?.adminPrincipals as string[])
    : [];
  const overrideAdmins = Array.isArray(overrideSection.adminPrincipals)
    ? (overrideSection.adminPrincipals as string[])
    : [];

  return Array.from(new Set([...originalAdmins, ...overrideAdmins]));
};

export const applyProviderConfig = async (
  apiContext: APIRequestContext,
  original: SecurityConfigSnapshot,
  override: ProviderConfigOverride
): Promise<void> => {
  const originalAuth =
    (original.authenticationConfiguration as Record<string, unknown>) ?? {};
  const originalAuthorizer =
    (original.authorizerConfiguration as Record<string, unknown>) ?? {};

  const merged: SecurityConfigSnapshot = {
    ...original,
    authenticationConfiguration: {
      ...originalAuth,
      ...override.authenticationConfiguration,
    },
    authorizerConfiguration: {
      ...originalAuthorizer,
      ...override.authorizerConfiguration,
      adminPrincipals: mergeAdminPrincipals(
        originalAuthorizer,
        override.authorizerConfiguration
      ),
    },
  };

  const response = await apiContext.put(SECURITY_CONFIG_ENDPOINT, {
    data: merged,
  });

  if (response.status() !== 200) {
    // Surface the server's rejection reason instead of a bare
    // `Received: 400`. Fixtures per-provider each land in different
    // schema branches (basic vs oidc vs saml vs ldap); without the body
    // it's guesswork which field the server disliked.
    const body = await response.text().catch(() => '<no body>');

    throw new Error(
      `[applyProviderConfig] PUT ${SECURITY_CONFIG_ENDPOINT} → ${response.status()}. Body: ${body}`
    );
  }
};

export const restoreSecurityConfig = async (
  apiContext: APIRequestContext,
  snapshot: SecurityConfigSnapshot
): Promise<void> => {
  const response = await apiContext.put(SECURITY_CONFIG_ENDPOINT, {
    data: snapshot,
  });

  expect(response.status()).toBe(200);
};

/**
 * Mints a personal access token for the admin `apiContext` is authenticated as.
 *
 * Neither obvious credential survives a provider swap. The admin's own login
 * token is session-bound, and `JwtFilter.validateSessionProviderIsCurrent`
 * rejects a session minted under the decommissioned provider (401). A JWT from
 * a fresh SSO login is accepted, but it belongs to a self-signed-up IdP user
 * that `authorizeAdmin` will not let near `PUT /system/security/config` (403) —
 * and adding them to `adminPrincipals` does not help, because `isAdmin` lives on
 * the User entity and a security reload never re-bootstraps it.
 *
 * A PAT clears both bars: it carries no `sessionId` claim, so
 * `JwtFilter.validateSessionBoundToken` returns before the provider check ever
 * runs, and it belongs to the real admin. It stays verifiable after the swap
 * because every provider payload keeps OpenMetadata's own JWKS in
 * `publicKeyUrls`, and `isInternallyIssuedToken` exempts it from principal-domain
 * enforcement.
 */
export const mintAdminRestoreToken = async (
  apiContext: APIRequestContext
): Promise<string> => {
  const response = await apiContext.put(PERSONAL_ACCESS_TOKEN_ENDPOINT, {
    data: {
      tokenName: `sso-e2e-restore-${Date.now()}`,
      JWTTokenExpiry: '1',
    },
  });

  expect(response.status()).toBe(200);

  const { jwtToken } = (await response.json()) as { jwtToken?: string };

  if (!jwtToken) {
    throw new Error('Personal access token response carried no jwtToken');
  }

  return jwtToken;
};

/**
 * Applies `override` for the lifetime of a suite; returns the restore function.
 *
 * The restore token is minted before the swap and is provider-independent, so
 * callers do not need a live SSO session in `afterAll` — see
 * {@link mintAdminRestoreToken}.
 */
export const swapSecurityConfig = async (
  browser: Browser,
  override: ProviderConfigOverride
): Promise<() => Promise<void>> => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  try {
    // Mint before the swap: it needs an admin the current provider still accepts,
    // and failing here must abort rather than leave the server in SSO mode.
    const restoreToken = await mintAdminRestoreToken(apiContext);
    const snapshot = await fetchSecurityConfig(apiContext);

    await applyProviderConfig(apiContext, snapshot, override);

    return async () => {
      const adminContext = await getAuthContext(restoreToken);

      try {
        await restoreSecurityConfig(adminContext, snapshot);
      } finally {
        await adminContext.dispose();
      }
    };
  } finally {
    await afterAction();
  }
};

export const verifyLoggedInUserMatches = async (
  page: Page,
  expectedEmail: string
): Promise<void> => {
  const { apiContext, afterAction } = await getApiContext(page);

  try {
    const response = await apiContext.get('/api/v1/users/loggedInUser');

    expect(response.status()).toBe(200);

    const user = await response.json();
    const expected = expectedEmail.toLowerCase();

    expect(user.email?.toLowerCase()).toBe(expected);
  } finally {
    await afterAction();
  }
};
