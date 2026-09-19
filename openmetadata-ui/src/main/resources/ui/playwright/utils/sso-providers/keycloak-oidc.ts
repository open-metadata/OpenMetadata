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
  restoreSecurityConfig,
} from '../ssoAuth';
import { SsoProviderFixture } from './fixture';
import { forceTokenExpiry } from './force-token-expiry';
import { ProviderHelper } from './index';
import {
  assertSupportedBaseUrl,
  escapeRegExp,
  KEYCLOAK_SAML,
  KEYCLOAK_SEEDED_CREDS,
  performProviderLogin,
} from './keycloak-saml';

// Throwaway fixture credentials, committed like the realm user's password.
const CLIENT = {
  id: 'openmetadata-oidc-confidential',
  secret: 'openmetadata-oidc-secret',
} as const;

// OM fetches discovery and exchanges the code from inside its container, where
// localhost is its own loopback. Same split as mock-oidc-provider's
// ISSUER vs INTERNAL_BASE_URL.
const INTERNAL_BASE_URL =
  process.env[SSO_ENV.KEYCLOAK_INTERNAL_BASE_URL] ??
  'http://openmetadata-keycloak-saml:8080';

const buildConfigPayload = (): ProviderConfigOverride => {
  assertSupportedBaseUrl();

  const realm = KEYCLOAK_SAML.azureRealm;
  const authority = `${KEYCLOAK_SAML.baseUrl}/realms/${realm}`;
  const internal = `${INTERNAL_BASE_URL}/realms/${realm}`;

  return {
    authenticationConfiguration: {
      clientType: 'confidential',
      provider: 'custom-oidc',
      providerName: 'Keycloak',
      publicKeyUrls: [
        `${OM_BASE_URL}/api/v1/system/config/jwks`,
        `${internal}/protocol/openid-connect/certs`,
      ],
      tokenValidationAlgorithm: 'RS256',
      authority,
      clientId: CLIENT.id,
      callbackUrl: `${OM_BASE_URL}/callback`,
      jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
      enableSelfSignup: true,
      oidcConfiguration: {
        id: CLIENT.id,
        type: 'custom-oidc',
        secret: CLIENT.secret,
        scope: 'openid email profile',
        discoveryUri: `${internal}/.well-known/openid-configuration`,
        // Required by oidcClientConfig.json despite reading as Azure-only.
        tenant: realm,
        callbackUrl: `${OM_BASE_URL}/callback`,
        serverUrl: OM_BASE_URL,
        responseType: 'code',
        clientAuthenticationMethod: 'client_secret_basic',
        preferredJwsAlgorithm: 'RS256',
        disablePkce: true,
      },
    },
    authorizerConfiguration: {
      principalDomain: KEYCLOAK_SAML.principalDomain,
    },
  };
};

export const keycloakOidcConfidentialProviderHelper: ProviderHelper = {
  expectedButtonText: 'Sign in with Keycloak',
  loginUrlPattern: new RegExp(
    `/realms/${escapeRegExp(KEYCLOAK_SAML.azureRealm)}/`
  ),
  buildConfigPayload,
  performProviderLogin,
};

// ── New SsoProviderFixture surface ────────────────────────────────────────

export const keycloakOidcConfidentialProviderFixture: SsoProviderFixture = {
  name: 'Keycloak OIDC (confidential)',
  slug: 'keycloak-oidc-confidential',
  clientType: 'confidential',
  loginKind: 'redirect',

  supportsCrossTab: true,
  supportsSelfSignup: true,
  supportsSilentCallback: false,
  usesBackendRefresh: true,

  signInButtonPattern: /(sign in|log in) with Keycloak/i,

  isAvailable: () => Boolean(process.env[SSO_ENV.KEYCLOAK_SAML_BASE_URL]),
  unavailableReason: () =>
    `Set ${SSO_ENV.KEYCLOAK_SAML_BASE_URL} to run the Keycloak OIDC fixture.`,

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
      username: KEYCLOAK_SEEDED_CREDS.username,
      password: KEYCLOAK_SEEDED_CREDS.password,
    });
    // Diagnostic (round-10): scenarios 1-6 all time out on the sidebar
    // after the Keycloak login submission — the real IdP round-trip
    // completes but the SPA never lands on the authenticated shell.
    // Capture the actual URL + loggedInUser response so the next CI
    // log tells us why (session cookie missing / JWT rejected / stuck
    // on /callback / etc.).
    try {
      await expect(page.getByTestId('app-bar-item-my-data')).toBeVisible({
        timeout: 60_000,
      });
    } catch (originalError) {
      const url = page.url();
      const loggedInUserResp = await page.request
        .get('/api/v1/users/loggedInUser?fields=profile')
        .then(async (r) => `${r.status()} ${(await r.text()).slice(0, 200)}`)
        .catch((err) => `<request failed: ${(err as Error).message}>`);
      const bodyText = await page
        .locator('body')
        .innerText({ timeout: 2_000 })
        .catch(() => '<innerText failed>');

      throw new Error(
        `keycloak-oidc-confidential performLogin: sidebar never appeared.\n` +
          `  page.url()               = ${url}\n` +
          `  GET /users/loggedInUser  = ${loggedInUserResp}\n` +
          `  body.innerText (first 300) = ${bodyText.slice(0, 300)}\n` +
          `  original: ${(originalError as Error).message}`
      );
    }
  },

  async performLogout(page: Page) {
    await page.getByTestId('app-bar-item-logout').click();
    await page.getByTestId('confirm-logout').click();
    await expect(page).toHaveURL(/\/signin$/);
  },

  forceTokenExpiry,
};
