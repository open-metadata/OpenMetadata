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
import { SsoBrokenConfigureResult, SsoProviderFixture } from './fixture';
import { ProviderHelper } from './index';
import {
  assertSupportedBaseUrl,
  escapeRegExp,
  KEYCLOAK_SAML,
  performProviderLogin,
} from './keycloak-saml';

// Public client — no secret. The browser (oidc-client UserManager) drives the
// whole authorization-code flow, so this is the fixture that exercises
// getUserManagerConfig. The realm client has implicit flow disabled, so a login
// that (wrongly) requests response_type=id_token is rejected by Keycloak — this
// is the front-channel regression guard for #29597.
const CLIENT_ID = 'openmetadata-oidc-public';

// OM validates the discovered JWKS from inside its container, where localhost is
// its own loopback — mirror keycloak-oidc.ts's ISSUER vs INTERNAL split.
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
      clientType: 'public',
      provider: 'custom-oidc',
      providerName: 'Keycloak',
      // Persisted as 'code'; the fix must carry it into the browser's authorize
      // request instead of falling back to oidc-client's 'id_token' default.
      responseType: 'code',
      publicKeyUrls: [
        `${OM_BASE_URL}/api/v1/system/config/jwks`,
        `${internal}/protocol/openid-connect/certs`,
      ],
      tokenValidationAlgorithm: 'RS256',
      authority,
      clientId: CLIENT_ID,
      callbackUrl: `${OM_BASE_URL}/callback`,
      jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
      enableSelfSignup: true,
      oidcConfiguration: {
        // Mirror the top-level fields into oidcConfiguration so the broken
        // variant has a nested handle to mangle; the server tolerates the
        // extra block on public clients.
        id: CLIENT_ID,
        type: 'custom-oidc',
        // Server-side schema (oidcClientConfig.json) makes `secret` and
        // `tenant` non-null even for public clients — the browser flow ignores
        // them but the PUT is rejected without them.
        secret: 'public-client-no-secret',
        tenant: realm,
        scope: 'openid email profile',
        discoveryUri: `${internal}/.well-known/openid-configuration`,
        callbackUrl: `${OM_BASE_URL}/callback`,
        serverUrl: OM_BASE_URL,
        responseType: 'code',
        preferredJwsAlgorithm: 'RS256',
      },
    },
    authorizerConfiguration: {
      principalDomain: KEYCLOAK_SAML.principalDomain,
    },
  };
};

export const keycloakOidcPublicProviderHelper: ProviderHelper = {
  expectedButtonText: 'Sign in with Keycloak',
  loginUrlPattern: new RegExp(
    `/realms/${escapeRegExp(KEYCLOAK_SAML.azureRealm)}/`
  ),
  expectedResponseType: 'code',
  buildConfigPayload,
  performProviderLogin,
};

// ── New SsoProviderFixture surface ────────────────────────────────────────

export const keycloakOidcPublicProviderFixture: SsoProviderFixture = {
  name: 'Keycloak OIDC (public)',
  slug: 'keycloak-oidc-public',
  clientType: 'public',
  loginKind: 'redirect',

  supportsCrossTab: true,
  supportsSelfSignup: true,
  // Public OIDC is the only one that drives the /silent-callback iframe
  // via oidc-client's signinSilent — same-origin refresh with no popup.
  supportsSilentCallback: true,

  expectedResponseType: 'code',
  signInButtonPattern: /(sign in|log in) with Keycloak/i,

  isAvailable: () => Boolean(process.env[SSO_ENV.KEYCLOAK_SAML_BASE_URL]),
  unavailableReason: () =>
    `Set ${SSO_ENV.KEYCLOAK_SAML_BASE_URL} to run the Keycloak OIDC public fixture.`,

  async configureBackend(apiContext: APIRequestContext) {
    const snapshot = await fetchSecurityConfig(apiContext);
    await applyProviderConfig(apiContext, snapshot, buildConfigPayload());

    return {
      restore: async () => {
        await restoreSecurityConfig(apiContext, snapshot);
      },
    };
  },

  async configureBrokenBackend(
    apiContext: APIRequestContext
  ): Promise<SsoBrokenConfigureResult> {
    const snapshot = await fetchSecurityConfig(apiContext);
    const payload = buildConfigPayload();
    // Force oidcConfiguration.responseType to an invalid value so the
    // client-side validator refuses to boot the UserManager.
    const authConfig = payload.authenticationConfiguration as Record<
      string,
      unknown
    >;
    const oidcConfig = authConfig.oidcConfiguration as Record<string, unknown>;
    oidcConfig.responseType = 'invalid';

    await applyProviderConfig(apiContext, snapshot, payload);

    return {
      restore: async () => {
        await restoreSecurityConfig(apiContext, snapshot);
      },
      expectedWarningPattern: /oidcConfiguration\.responseType|responseType/,
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
    await page.getByTestId('dropdown-profile').click();
    await page.getByTestId('menu-item-logout').click();
    await expect(page).toHaveURL(/\/signin$/);
  },

  async forceTokenExpiry(page: Page) {
    await page.evaluate(() => {
      const raw = localStorage.getItem('oidcIdToken');
      if (!raw) return;
      const [header, , sig] = raw.split('.');
      const payload = { exp: Math.floor(Date.now() / 1000) - 60 };
      const b64 = (obj: unknown) =>
        btoa(JSON.stringify(obj))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      localStorage.setItem('oidcIdToken', `${header}.${b64(payload)}.${sig}`);
    });
  },
};
