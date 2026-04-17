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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { getApiContext } from './common';

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

// Round-trippable = can be GET'd and PUT back unchanged. These two aren't:
// GET returns empty-string placeholders that the PUT validator rejects.
const NON_ROUND_TRIPPABLE_AUTH_FIELDS = [
  'ldapConfiguration',
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

  expect(response.status()).toBe(200);
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
