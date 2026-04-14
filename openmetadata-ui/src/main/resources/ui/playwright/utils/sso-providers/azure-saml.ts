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
import { ProviderHelper } from './index';
import { fetchIdpX509Certificate } from './saml-metadata';

// Tenant ID and principal domain are public Azure metadata — safe to commit.
const AZURE_SAML_TENANT = {
  tenantId:
    process.env[SSO_ENV.AZURE_SAML_TENANT_ID] ??
    'face9c4e-1b50-41d3-b404-d4d2432a5be3',
  principalDomain:
    process.env[SSO_ENV.AZURE_SAML_PRINCIPAL_DOMAIN] ?? 'getcollate.io',
} as const;

const federationMetadataUrl = (tenantId: string): string =>
  `https://login.microsoftonline.com/${tenantId}/federationmetadata/2007-06/federationmetadata.xml`;

const buildConfigPayload = async (): Promise<ProviderConfigOverride> => {
  const { tenantId } = AZURE_SAML_TENANT;
  const idpX509Certificate = await fetchIdpX509Certificate(
    federationMetadataUrl(tenantId),
    `Azure tenant "${tenantId}"`
  );

  return {
    authenticationConfiguration: {
      provider: 'saml',
      providerName: 'Azure AD',
      jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
      enableSelfSignup: true,
      samlConfiguration: {
        idp: {
          entityId: `https://sts.windows.net/${tenantId}/`,
          ssoLoginUrl: `https://login.microsoftonline.com/${tenantId}/saml2`,
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
          wantAssertionsSigned: false,
        },
        debugMode: false,
      },
    },
    authorizerConfiguration: {
      principalDomain: AZURE_SAML_TENANT.principalDomain,
    },
  };
};

const performProviderLogin = async (
  page: Page,
  { username, password }: ProviderCredentials
): Promise<void> => {
  const emailInput = page.locator('input[type="email"]');

  await expect(emailInput).toBeVisible();
  await emailInput.fill(username);

  const nextButton = page.locator('input[type="submit"]');

  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  const passwordInput = page.locator('input[type="password"]');

  await expect(passwordInput).toBeVisible();
  await passwordInput.fill(password);

  const signInButton = page.locator('input[type="submit"]');

  await expect(signInButton).toBeEnabled();
  await signInButton.click();

  const staySignedInNo = page.locator('input#idBtn_Back');

  if (await staySignedInNo.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await staySignedInNo.click();
  }
};

export const azureSamlProviderHelper: ProviderHelper = {
  expectedButtonText: 'Sign in with SAML SSO',
  loginUrlPattern: /login\.microsoftonline\.com/,
  buildConfigPayload,
  performProviderLogin,
};
