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
import { SsoProviderFixture, SsoProviderSlug } from './fixture';
import { forceTokenExpiry } from './force-token-expiry';
import type { ProviderHelper } from './index';
import { fetchIdpX509Certificate } from './saml-metadata';

const SUPPORTED_OM_BASE_URL = 'http://localhost:8585';

export const KEYCLOAK_SAML = {
  baseUrl:
    process.env[SSO_ENV.KEYCLOAK_SAML_BASE_URL] ?? 'http://localhost:8080',
  azureRealm: process.env[SSO_ENV.KEYCLOAK_SAML_AZURE_REALM] ?? 'om-azure-saml',
  principalDomain:
    process.env[SSO_ENV.KEYCLOAK_SAML_PRINCIPAL_DOMAIN] ?? 'openmetadata.local',
} as const;

// The Keycloak realms in `docker/local-sso/keycloak-saml/realms/*.json` seed
// exactly one test user with these creds. They aren't secrets — they're
// checked into the repo. Fixtures fall back to these when
// `SSO_USERNAME`/`SSO_PASSWORD` env vars are empty in CI, so the leg still
// works even without repo-admin var configuration. Real IdPs (Okta) still
// require actual env vars — the fallback only applies to Keycloak.
export const KEYCLOAK_SEEDED_CREDS = {
  username: process.env[SSO_ENV.USERNAME] || 'azure.saml@openmetadata.local',
  password: process.env[SSO_ENV.PASSWORD] || 'OpenMetadata@123',
} as const;

interface KeycloakSamlProfile {
  realm: string;
  providerName: string;
}

export const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const assertSupportedBaseUrl = (): void => {
  if (OM_BASE_URL !== SUPPORTED_OM_BASE_URL) {
    throw new Error(
      `Keycloak SAML fixture realms are imported for ${SUPPORTED_OM_BASE_URL}. ` +
        `Set PLAYWRIGHT_TEST_BASE_URL=${SUPPORTED_OM_BASE_URL} or update the realm import files before running with ${OM_BASE_URL}.`
    );
  }
};

const buildConfigPayload = async ({
  realm,
  providerName,
}: KeycloakSamlProfile): Promise<ProviderConfigOverride> => {
  assertSupportedBaseUrl();

  const realmBaseUrl = `${KEYCLOAK_SAML.baseUrl}/realms/${realm}`;
  const idpX509Certificate = await fetchIdpX509Certificate(
    `${realmBaseUrl}/protocol/saml/descriptor`,
    `Keycloak realm "${realm}"`
  );

  return {
    authenticationConfiguration: {
      provider: 'saml',
      providerName,
      jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
      enableSelfSignup: true,
      samlConfiguration: {
        idp: {
          entityId: realmBaseUrl,
          ssoLoginUrl: `${realmBaseUrl}/protocol/saml`,
          idpX509Certificate,
          nameId: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        },
        sp: {
          entityId: `${OM_BASE_URL}/api/v1/saml/metadata`,
          acs: `${OM_BASE_URL}/api/v1/saml/acs`,
          callback: `${OM_BASE_URL}/callback`,
        },
        security: {
          strictMode: false,
          tokenValidity: 3600,
          sendEncryptedNameId: false,
          sendSignedAuthRequest: false,
          wantMessagesSigned: false,
          wantAssertionsSigned: true,
        },
        debugMode: false,
      },
    },
    authorizerConfiguration: {
      principalDomain: KEYCLOAK_SAML.principalDomain,
    },
  };
};

// Keycloak renders the same login theme for every protocol in a realm, so the
// OIDC leg reuses this driver verbatim.
export const performProviderLogin = async (
  page: Page,
  { username, password }: ProviderCredentials
): Promise<void> => {
  const usernameInput = page
    .locator('input#username, input[name="username"]')
    .first();

  await expect(usernameInput).toBeVisible();
  await usernameInput.fill(username);

  const passwordInput = page
    .locator('input#password, input[name="password"]')
    .first();

  await expect(passwordInput).toBeVisible();
  await passwordInput.fill(password);

  const loginButton = page
    .locator(
      'input#kc-login, button[name="login"], input[type="submit"], button[type="submit"]'
    )
    .first();

  await expect(loginButton).toBeEnabled();
  await loginButton.click();
};

// OM renders a fixed "SAML SSO" label for every SAML provider — providerName
// is dropped for the SAML branch of getAuthConfig.
const createKeycloakSamlProviderHelper = (
  profile: KeycloakSamlProfile
): ProviderHelper => ({
  expectedButtonText: 'Sign in with SAML SSO',
  loginUrlPattern: new RegExp(`/realms/${escapeRegExp(profile.realm)}/`),
  buildConfigPayload: () => buildConfigPayload(profile),
  performProviderLogin,
});

export const keycloakAzureSamlProviderHelper = createKeycloakSamlProviderHelper(
  {
    realm: KEYCLOAK_SAML.azureRealm,
    providerName: 'Azure AD',
  }
);

// ── New SsoProviderFixture surface ────────────────────────────────────────
//
// The scenario suite consumes SsoProviderFixture. The legacy ProviderHelper
// above stays exported for backwards compatibility (index.ts still consumes
// it) — commit 7 removes it after all call-sites migrate.

const SAML_PROFILE: KeycloakSamlProfile = {
  realm: KEYCLOAK_SAML.azureRealm,
  providerName: 'Azure AD',
};

// The crosssite variant swaps the IdP host to 127.0.0.1 (a different site
// from localhost) via KEYCLOAK_SAML_BASE_URL; the callback POST is then
// cross-site and the SameSite=Lax OM_SESSION cookie is dropped. That means
// the browser can't observe the storage broadcast across tabs, so this
// fixture opts out of the cross-tab scenario.
const IS_CROSSSITE =
  process.env[SSO_ENV.PROVIDER_TYPE] === 'keycloak-azure-saml-crosssite';

export const keycloakSamlProviderFixture: SsoProviderFixture = {
  name: IS_CROSSSITE ? 'Keycloak SAML (cross-site)' : 'Keycloak SAML',
  slug: (IS_CROSSSITE
    ? 'keycloak-saml-crosssite'
    : 'keycloak-saml') as SsoProviderSlug,
  clientType: 'public',
  loginKind: 'redirect',

  supportsCrossTab: !IS_CROSSSITE,
  supportsSelfSignup: true,
  supportsSilentCallback: false,
  usesBackendRefresh: true,

  signInButtonPattern: /(sign in|log in) with SAML SSO/i,

  isAvailable: () => Boolean(process.env[SSO_ENV.KEYCLOAK_SAML_BASE_URL]),
  unavailableReason: () =>
    `Set ${SSO_ENV.KEYCLOAK_SAML_BASE_URL} to run the Keycloak SAML fixture.`,

  async configureBackend(apiContext: APIRequestContext) {
    const snapshot = await fetchSecurityConfig(apiContext);
    const payload = await buildConfigPayload(SAML_PROFILE);
    await applyProviderConfig(apiContext, snapshot, payload);

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
