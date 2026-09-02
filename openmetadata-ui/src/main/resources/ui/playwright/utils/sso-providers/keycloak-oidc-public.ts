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
  usesBackendRefresh: false,

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

  async performLogin(page: Page) {
    await page.goto('/signin');
    await page.getByRole('button', { name: this.signInButtonPattern }).click();
    await performProviderLogin(page, {
      username: KEYCLOAK_SEEDED_CREDS.username,
      password: KEYCLOAK_SEEDED_CREDS.password,
    });

    // Public OIDC's SPA-driven flow doesn't have OM's BE-mediated code
    // exchange auto-creating the user (that only fires for `clientType:
    // confidential` via AuthenticationCodeFlowHandler.getOrCreateOidcUser).
    // With `enableSelfSignup: true` in our config, `handleSuccessfulLogin`
    // catches the 404 on /users/loggedInUser and navigates to /signup with
    // the token's profile pre-filled. The Keycloak-realm-seeded user
    // (azure.saml@openmetadata.local) exists only in the realm, not in
    // OM's DB, so first login of this leg lands on /signup. Complete the
    // form so scenario 1 finishes and the user persists for scenarios
    // 2-6. Confidential OIDC skips this because BE already created the
    // user during code exchange.
    // Race between the sidebar (user already exists → straight to authed
    // shell) and the signup Create button (fresh user → SPA navigates to
    // /signup with token claims pre-filled). `Locator.isVisible()` doesn't
    // wait — it snapshots — so use a wait on either surface. The
    // create-button state assertion is what actually blocks until the SPA
    // finishes processing /callback and mounts the signup route; the
    // previous 5s isVisible poll returned false while the SPA was still on
    // /callback, and the signup completion never ran.
    const sidebarLocator = page.getByTestId('app-bar-item-my-data');
    const createButton = page.getByTestId('create-button');
    const submissionPending = page
      .waitForResponse(
        (resp) => resp.url().includes('/api/v1/users') && resp.status() < 400
      )
      .catch(() => undefined);
    const signupAppeared = await Promise.race([
      createButton.waitFor({ state: 'visible', timeout: 30_000 }).then(
        () => true,
        () => false
      ),
      sidebarLocator.waitFor({ state: 'visible', timeout: 30_000 }).then(
        () => false,
        () => false
      ),
    ]);
    if (signupAppeared) {
      // displayName is required; the SPA pre-fills it from token claims but
      // the KC realm's user has no given_name claim, so fill deterministically.
      const fullNameInput = page.getByTestId('full-name-input');
      const currentName = await fullNameInput.inputValue().catch(() => '');
      if (!currentName) {
        await fullNameInput.fill('Azure Saml');
      }
      await createButton.click();
      await submissionPending;
    }

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
        `keycloak-oidc-public performLogin: sidebar never appeared.\n` +
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
