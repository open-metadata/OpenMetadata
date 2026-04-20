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
