/*
 *  Copyright 2026 Collate.
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
//
// Auth0 fixture backed by the mock IdP (docker/development/mock-oidc-provider).
//
// Replaces the earlier `auth0-mock.ts`, which installed `window.__omTestAuth0`
// via `page.addInitScript` to short-circuit `useAuth0()` — this fixture
// exercises the *real* `@auth0/auth0-react` SDK end to end. The mock IdP
// serves Auth0-shape URL aliases (`/authorize`, `/oauth/token`, `/userinfo`,
// `/v2/logout`, `/.well-known/jwks.json` — see mock-oidc-provider/server.js)
// that rewrite to the underlying oidc-provider paths, so the SDK cannot
// tell it isn't talking to Auth0. That kills the source-side test shim
// (Copilot review #8) and the fixture also becomes real end-to-end
// evidence that `Auth0Authenticator` behaves correctly against a live IdP
// rather than against a hand-rolled Promise map.
//
import { APIRequestContext, expect, Page } from '@playwright/test';
import {
  MOCK_AUTH0_CLIENT_ID,
  MOCK_AUTH0_DOMAIN,
  MOCK_OIDC_INTERNAL_JWKS_URL,
  waitForMockOidcReady,
} from '../mockOidc';
import {
  applyProviderConfig,
  fetchSecurityConfig,
  restoreSecurityConfig,
} from '../ssoAuth';
import { SsoProviderFixture } from './fixture';
import { forceTokenExpiry } from './force-token-expiry';

const CALLBACK_URL = 'http://localhost:8585/callback';

const buildValidConfig = () => ({
  authenticationConfiguration: {
    clientType: 'public',
    provider: 'auth0',
    providerName: 'Auth0 (mock)',
    // OM's own JWKS (for admin PATs the AuthCoordinator falls back to)
    // + the mock IdP's JWKS via its docker-network internal name so the
    // backend can actually reach it. Under local dev they collapse to
    // the same localhost URL; only docker-compose runs need the split.
    publicKeyUrls: [
      'http://localhost:8585/api/v1/system/config/jwks',
      MOCK_OIDC_INTERNAL_JWKS_URL,
    ],
    tokenValidationAlgorithm: 'RS256',
    // Authority = the mock IdP's own base URL. `getAuth0ProviderConfig` in
    // AuthProvider.tsx maps this straight into `Auth0Provider`'s `domain`
    // prop, so the SDK hits ${domain}/.well-known/openid-configuration
    // and (for the hard-coded paths) ${domain}/authorize + /oauth/token
    // — which the mock's Auth0-shape aliases handle.
    authority: MOCK_AUTH0_DOMAIN,
    clientId: MOCK_AUTH0_CLIENT_ID,
    callbackUrl: CALLBACK_URL,
    // The mock's seeded admin account has `sub: 'admin'` and
    // `email: 'admin@open-metadata.org'`; OM's own admin user is created
    // at boot with the same email (see UserUtil / openmetadata.yaml
    // principalDomain default). `email` first in the claim list makes
    // `/users/loggedInUser` resolve on both cold-load and refresh.
    jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
    enableSelfSignup: false,
    oidcConfiguration: {
      id: MOCK_AUTH0_CLIENT_ID,
      type: 'auth0',
      // Server-side schema (oidcClientConfig.json) requires `secret` and
      // `tenant` on every entry even for public clients; the browser flow
      // never sends them, but PUT is rejected if either is null.
      secret: 'unused-public-client',
      tenant: 'mock',
      scope: 'openid email profile offline_access',
      discoveryUri: `${MOCK_AUTH0_DOMAIN}/.well-known/openid-configuration`,
      callbackUrl: CALLBACK_URL,
      responseType: 'code',
    },
  },
  authorizerConfiguration: {
    principalDomain: 'open-metadata.org',
    adminPrincipals: ['admin'],
  },
});

/**
 * Auth0 fixture. Real `@auth0/auth0-react` SDK, real PKCE flow, mock IdP.
 */
export const auth0ProviderFixture: SsoProviderFixture = {
  name: 'Auth0 (mock IdP)',
  slug: 'auth0-mock',
  clientType: 'public',
  loginKind: 'redirect',

  // Auth0Provider is mounted with `cacheLocation="memory"` (see
  // AuthProvider.tsx: renderAuthenticatorForProvider Auth0 branch), so the
  // SDK's OWN token cache is per-tab. But OM's AuthCoordinator writes every
  // refreshed token into shared SW/IndexedDB storage via setOidcToken(), so
  // a second tab that boots after the first hits the cold-load path and
  // finds a valid token. Cross-tab thus still holds at the app level.
  supportsCrossTab: true,
  supportsSelfSignup: false,
  // Auth0's silent renewal is `getAccessTokenSilently()` which uses its
  // own hidden iframe pointed at ${domain}/authorize — not OM's own
  // /silent-callback route. That route is oidc-client-specific
  // (OidcAuthenticator/keycloak-oidc-public only).
  supportsSilentCallback: false,
  usesBackendRefresh: false,

  isAvailable: () => Boolean(process.env.MOCK_OIDC_URL),
  unavailableReason: () =>
    'Set MOCK_OIDC_URL to run the Auth0 fixture (docker service `mock-oidc-provider` under COMPOSE_PROFILES=sso-test).',

  // Permissive so "Sign in with Auth0", "Sign in with Auth0 (mock)", and
  // "Log in with Auth0" all match — the exact copy depends on how
  // SignInPage stitches together `providerName` from the server config.
  signInButtonPattern: /(sign|log) in with auth0/i,

  async configureBackend(apiContext: APIRequestContext) {
    // Fail-fast on the docker service being missing: without the mock
    // running, every scenario would time out on the /authorize redirect.
    // waitForMockOidcReady polls /health with a short budget and produces
    // an actionable message instead.
    await waitForMockOidcReady(apiContext);
    const snapshot = await fetchSecurityConfig(apiContext);
    await applyProviderConfig(apiContext, snapshot, buildValidConfig());

    return {
      restore: async () => {
        await restoreSecurityConfig(apiContext, snapshot);
      },
    };
  },

  async performLogin(page: Page) {
    await page.goto('/signin');
    await page.getByRole('button', { name: this.signInButtonPattern }).click();
    // Auth0 SDK redirects to ${domain}/authorize; the mock's interaction
    // handler auto-approves as `admin` and redirects back to /callback with
    // a code. Auth0Callback processes the code → token exchange → app
    // shell mounts. The `nav-user-name`/`app-bar-item-my-data` locator is
    // the reliable "authenticated shell is live" signal.
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
        `auth0 performLogin: sidebar never appeared.\n` +
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
