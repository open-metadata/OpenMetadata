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
import { Page } from '@playwright/test';
import { OM_BASE_URL } from '../../constant/ssoAuth';
import {
  MOCK_OIDC_CLIENT_ID,
  MOCK_OIDC_CLIENT_SECRET,
  MOCK_OIDC_DISCOVERY_URL,
} from '../mockOidc';
import { ProviderConfigOverride, ProviderCredentials } from '../ssoAuth';
import { FillFormOverrides, ProviderHelper } from './index';

// pac4j inside the OM container can't reach localhost:9090 — must use the
// docker-network hostname for server-side discovery.
const SERVER_DISCOVERY_URI =
  process.env.MOCK_OIDC_SERVER_DISCOVERY_URI ??
  'http://mock-oidc-provider:9090/.well-known/openid-configuration';

const buildConfigPayload = (): ProviderConfigOverride => {
  const browserAuthority = MOCK_OIDC_DISCOVERY_URL.replace(
    /\/\.well-known\/openid-configuration$/,
    ''
  );
  const serverAuthority = SERVER_DISCOVERY_URI.replace(
    /\/\.well-known\/openid-configuration$/,
    ''
  );

  return {
    authenticationConfiguration: {
      provider: 'custom-oidc',
      providerName: 'mock-oidc',
      clientType: 'confidential',
      authority: browserAuthority,
      clientId: MOCK_OIDC_CLIENT_ID,
      callbackUrl: `${OM_BASE_URL}/callback`,
      publicKeyUrls: [
        `${serverAuthority}/jwks`,
        `${OM_BASE_URL}/api/v1/system/config/jwks`,
      ],
      tokenValidationAlgorithm: 'RS256',
      jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
      enableSelfSignup: true,
      oidcConfiguration: {
        id: MOCK_OIDC_CLIENT_ID,
        secret: MOCK_OIDC_CLIENT_SECRET,
        type: 'custom-oidc',
        discoveryUri: SERVER_DISCOVERY_URI,
        callbackUrl: `${OM_BASE_URL}/callback`,
        scope: 'openid email profile',
        clientAuthenticationMethod: 'client_secret_post',
        responseType: 'code',
        useNonce: true,
        preferredJwsAlgorithm: 'RS256',
        disablePkce: true,
      },
    },
    authorizerConfiguration: {
      principalDomain: 'open-metadata.org',
    },
  };
};

const performProviderLogin = async (
  _popup: Page,
  _credentials: ProviderCredentials
): Promise<void> => {
  // No-op: mock OIDC auto-approves and the popup self-closes.
};

const fillForm = async (
  page: Page,
  overrides: FillFormOverrides = {}
): Promise<void> => {
  await page
    .getByRole('textbox', { name: /^Client ID/ })
    .fill(MOCK_OIDC_CLIENT_ID);
  await page
    .getByRole('textbox', { name: /^Client Secret/ })
    .fill(overrides.secret ?? MOCK_OIDC_CLIENT_SECRET);
  await page
    .getByRole('textbox', { name: /^Discovery URI/ })
    .fill(SERVER_DISCOVERY_URI);

  const advancedToggle = page.getByTestId('sso-advanced-fields-toggle');
  if (await advancedToggle.isVisible().catch(() => false)) {
    const advancedPanel = page.getByTestId('sso-advanced-fields-panel');
    if (!(await advancedPanel.isVisible().catch(() => false))) {
      await advancedToggle.click();
    }
    const scopeField = page.getByRole('textbox', { name: /^Scope/ });
    if (await scopeField.isVisible().catch(() => false)) {
      await scopeField.fill('openid email profile');
    }
  }
};

export const customOidcProviderHelper: ProviderHelper = {
  expectedButtonText: 'Sign in with SSO',
  loginUrlPattern: /localhost:9090/,
  buildConfigPayload,
  performProviderLogin,
  fillForm,
};
