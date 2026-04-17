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
import { expect, Page } from '@playwright/test';
import { OM_BASE_URL, SSO_ENV } from '../../constant/ssoAuth';
import { ProviderConfigOverride, ProviderCredentials } from '../ssoAuth';
import type { ProviderHelper } from './index';
import { fetchIdpX509Certificate } from './saml-metadata';

const SUPPORTED_OM_BASE_URL = 'http://localhost:8585';

const KEYCLOAK_SAML = {
  baseUrl:
    process.env[SSO_ENV.KEYCLOAK_SAML_BASE_URL] ?? 'http://localhost:8080',
  azureRealm: process.env[SSO_ENV.KEYCLOAK_SAML_AZURE_REALM] ?? 'om-azure-saml',
  principalDomain:
    process.env[SSO_ENV.KEYCLOAK_SAML_PRINCIPAL_DOMAIN] ?? 'openmetadata.local',
} as const;

interface KeycloakSamlProfile {
  realm: string;
  providerName: string;
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const assertSupportedBaseUrl = (): void => {
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

const performProviderLogin = async (
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
