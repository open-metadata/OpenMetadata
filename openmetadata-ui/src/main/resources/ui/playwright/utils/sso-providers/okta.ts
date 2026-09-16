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
import { OM_BASE_URL, SSO_ENV } from '../../constant/ssoAuth';
import {
  applyProviderConfig,
  fetchSecurityConfig,
  ProviderConfigOverride,
  ProviderCredentials,
  restoreSecurityConfig,
} from '../ssoAuth';
import { SsoProviderFixture } from './fixture';
import { forceTokenExpiry } from './force-token-expiry';
import { ProviderHelper } from './index';

// Defaults target Collate's nightly test Okta tenant. These are non-secret
// OAuth public identifiers — visible on the hosted login page during any
// sign-in — so committing them is intentional. Override via the matching
// env vars to point the suite at a different tenant without a code change.
const OKTA_TENANT = {
  clientId: process.env[SSO_ENV.OKTA_CLIENT_ID] ?? '0oayn277hnOhUpVLd697',
  domain: process.env[SSO_ENV.OKTA_DOMAIN] ?? 'integrator-9351624.okta.com',
  principalDomain:
    process.env[SSO_ENV.OKTA_PRINCIPAL_DOMAIN] ?? 'getcollate.io',
} as const;

const buildConfigPayload = (): ProviderConfigOverride => {
  const authority = `https://${OKTA_TENANT.domain}/oauth2/default`;

  return {
    authenticationConfiguration: {
      clientType: 'public',
      provider: 'okta',
      providerName: '',
      publicKeyUrls: [
        `${OM_BASE_URL}/api/v1/system/config/jwks`,
        `${authority}/v1/keys`,
      ],
      tokenValidationAlgorithm: 'RS256',
      authority,
      clientId: OKTA_TENANT.clientId,
      callbackUrl: `${OM_BASE_URL}/callback`,
      jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
      enableSelfSignup: true,
      oidcConfiguration: {
        // Mirror clientId into oidcConfiguration so the broken variant has
        // a nested handle to drop without touching the top-level field
        // (which the server rejects at ingest before the client sees it).
        id: OKTA_TENANT.clientId,
        clientId: OKTA_TENANT.clientId,
        type: 'okta',
        scope: 'openid email profile',
        callbackUrl: `${OM_BASE_URL}/callback`,
        serverUrl: OM_BASE_URL,
        responseType: 'code',
      },
    },
    authorizerConfiguration: {
      principalDomain: OKTA_TENANT.principalDomain,
    },
  };
};

const performProviderLogin = async (
  page: Page,
  { username, password }: ProviderCredentials
): Promise<void> => {
  const identifierInput = page.locator('input[name="identifier"]');

  await expect(identifierInput).toBeVisible();
  await identifierInput.fill(username);

  const nextButton = page.locator('input[type="submit"]');

  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  const passwordInput = page.locator('input[type="password"]');

  await expect(passwordInput).toBeVisible();
  await passwordInput.fill(password);

  const verifyButton = page.locator('input[type="submit"]');

  await expect(verifyButton).toBeEnabled();
  await verifyButton.click();
};

export const oktaProviderHelper: ProviderHelper = {
  expectedButtonText: 'Sign in with Okta',
  loginUrlPattern: /\.okta\.com/,
  buildConfigPayload,
  performProviderLogin,
};

// ── New SsoProviderFixture surface ────────────────────────────────────────

export const oktaProviderFixture: SsoProviderFixture = {
  name: 'Okta',
  slug: 'okta',
  clientType: 'public',
  loginKind: 'redirect',

  supportsCrossTab: true,
  supportsSelfSignup: true,
  supportsSilentCallback: false,
  usesBackendRefresh: false,

  signInButtonPattern: /(sign in|log in) with Okta/i,

  isAvailable: () =>
    Boolean(
      process.env[SSO_ENV.OKTA_CLIENT_ID] && process.env[SSO_ENV.OKTA_DOMAIN]
    ),
  unavailableReason: () =>
    `Set ${SSO_ENV.OKTA_CLIENT_ID} and ${SSO_ENV.OKTA_DOMAIN} to run the Okta fixture.`,

  async configureBackend(apiContext: APIRequestContext) {
    const snapshot = await fetchSecurityConfig(apiContext);
    await applyProviderConfig(apiContext, snapshot, buildConfigPayload());

    return {
      restore: async () => {
        await restoreSecurityConfig(apiContext, snapshot);
      },
    };
  },

  async performLogin(page: Page) {
    await page.goto('/signin');
    await page.getByRole('button', { name: this.signInButtonPattern }).click();
    await performProviderLogin(page, {
      username: process.env[SSO_ENV.USERNAME] ?? '',
      password: process.env[SSO_ENV.PASSWORD] ?? '',
    });
    await expect(page.getByTestId('app-bar-item-my-data')).toBeVisible({
      timeout: 60_000,
    });
  },

  async performLogout(page: Page) {
    await page.getByTestId('app-bar-item-logout').click();
    await page.getByTestId('confirm-logout').click();
    await expect(page).toHaveURL(/\/signin$/);
  },

  forceTokenExpiry,
};
