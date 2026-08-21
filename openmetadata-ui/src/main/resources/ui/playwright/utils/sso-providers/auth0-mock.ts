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
// Auth0 fixture that mocks the SDK at the browser-context level.
//
// Design choice — test-hook over exposeBinding
// --------------------------------------------
// The fixture ships a mock Auth0 context via `page.addInitScript` under
// `window.__omTestAuth0`; `Auth0Authenticator.tsx` reads it in dev/test mode
// (behind `import.meta.env.MODE !== 'production'`) and uses it instead of
// `useAuth0()`'s real value. `page.exposeBinding` was the other option, but
// it forces a Node ↔ page hop on every SDK call, which turns the
// synchronous `useAuth0()` read into a Promise chain and breaks the
// authenticator's `useEffect` sequencing. A pure-in-page shim keeps the
// shape identical to what `@auth0/auth0-react` returns, so the code under
// test can't tell the difference.
//
// `Auth0Provider` in `AuthProvider.tsx` still mounts around the
// authenticator — the mock only replaces the *return value* of `useAuth0()`;
// the react-auth0 wiring still runs, which keeps the Rules-of-Hooks
// contract intact.
//
import { APIRequestContext, expect, Page } from '@playwright/test';
import {
  applyProviderConfig,
  fetchSecurityConfig,
  restoreSecurityConfig,
} from '../ssoAuth';
import { SsoBrokenConfigureResult, SsoProviderFixture } from './fixture';
import { mintMockJwt } from './mock-token';

const MOCK_EMAIL = 'admin@openmetadata.org';
const MOCK_NAME = 'Auth0 Mock Admin';
const MOCK_SUB = 'auth0|mock-admin';
const MOCK_DOMAIN = 'openmetadata-mock.us.auth0.com';
const MOCK_CLIENT_ID = 'auth0-mock-client';

// Auth0 access tokens default to 24 hours, but the ID-token JWTs the
// authenticator's Renewer path reads are typically 5-minute lived — that's
// what we mint here so `forceTokenExpiry` has room to work.
const TOKEN_LIFETIME_SECONDS = 300;

const buildValidConfig = () => ({
  authenticationConfiguration: {
    clientType: 'public',
    provider: 'auth0',
    providerName: 'Auth0 (mocked)',
    publicKeyUrls: [
      'http://localhost:8585/api/v1/system/config/jwks',
      `https://${MOCK_DOMAIN}/.well-known/jwks.json`,
    ],
    tokenValidationAlgorithm: 'RS256',
    authority: `https://${MOCK_DOMAIN}/`,
    clientId: MOCK_CLIENT_ID,
    callbackUrl: 'http://localhost:8585/callback',
    jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
    enableSelfSignup: false,
    oidcConfiguration: {
      id: MOCK_CLIENT_ID,
      type: 'auth0',
      scope: 'openid email profile',
      discoveryUri: `https://${MOCK_DOMAIN}/.well-known/openid-configuration`,
      callbackUrl: 'http://localhost:8585/callback',
      responseType: 'code',
    },
  },
  authorizerConfiguration: {
    principalDomain: 'openmetadata.org',
    adminPrincipals: ['admin'],
  },
});

const buildBrokenConfig = () => {
  const cfg = buildValidConfig();
  // Drop `discoveryUri` from `oidcConfiguration` per the fixture contract.
  // The client-side validator must name this exact missing field before
  // any Auth0 client is instantiated.
  const oidc = cfg.authenticationConfiguration.oidcConfiguration as Record<
    string,
    unknown
  >;
  delete oidc.discoveryUri;

  return cfg;
};

/**
 * Installs `window.__omTestAuth0` + a valid stored token before the app
 * mounts. `Auth0Authenticator` reads the shim on first render and uses it
 * in place of `useAuth0()`.
 */
const installAuth0Mock = async (page: Page): Promise<void> => {
  const idToken = mintMockJwt({
    email: MOCK_EMAIL,
    name: MOCK_NAME,
    sub: MOCK_SUB,
    expInSeconds: TOKEN_LIFETIME_SECONDS,
  });

  await page.addInitScript(
    ({ idToken, email, name, sub, lifetimeSeconds }) => {
      // Rebuild `exp` inside the page so the Auth0 shim advertises a claim
      // that matches the actual JWT — the renewer compares them.
      const nowSeconds = () => Math.floor(Date.now() / 1000);
      const claimsExp = () => nowSeconds() + lifetimeSeconds;

      const user = { email, name, sub, email_verified: true };

      const idTokenClaims = () => ({
        __raw: idToken,
        exp: claimsExp(),
        iat: nowSeconds(),
        email,
        name,
        sub,
        preferred_username: email,
      });

      (window as unknown as { __omTestAuth0: unknown }).__omTestAuth0 = {
        // Truthy authenticated state — the authenticator itself doesn't
        // read these, but downstream `useAuth0()` consumers might.
        isAuthenticated: true,
        isLoading: false,
        error: undefined,
        user,

        // The Renewer path calls `getAccessTokenSilently()` and then
        // `getIdTokenClaims()`; both must resolve without touching the
        // network.
        getAccessTokenSilently: async () => idToken,
        getIdTokenClaims: async () => idTokenClaims(),

        // `invokeLogin` in the authenticator kicks a redirect. Simulate
        // the return-from-IdP hop so the router picks up `/callback` and
        // the AuthProvider's redirect-completion effect finishes login.
        loginWithRedirect: async () => {
          window.location.href =
            window.location.origin + '/callback#code=auth0-mock';

          return undefined;
        },
        loginWithPopup: async () => undefined,

        // Auth0 `logout({ localOnly: true })` is a no-op in the mock —
        // the authenticator immediately follows with
        // `handleSuccessfulLogout()`, which owns the actual state teardown.
        logout: () => undefined,

        // Utility methods some downstream code paths poke at; kept as
        // no-ops so an accidental call doesn't throw.
        buildAuthorizeUrl: async () => window.location.origin,
        buildLogoutUrl: () => window.location.origin,
        handleRedirectCallback: async () => ({
          appState: undefined,
        }),
      };

      // Cold-load path: AuthCoordinator reads this on boot and flips
      // isAuthenticated=true without ever touching the (mocked) SDK.
      localStorage.setItem('oidcIdToken', idToken);
    },
    {
      idToken,
      email: MOCK_EMAIL,
      name: MOCK_NAME,
      sub: MOCK_SUB,
      lifetimeSeconds: TOKEN_LIFETIME_SECONDS,
    }
  );
};

/**
 * Auth0 fixture that mocks `@auth0/auth0-react`'s `useAuth0()` return value
 * at the page-context level. Exercises `Auth0Authenticator.tsx` end-to-end —
 * cold-load recognises the pre-seeded token, and any silent-refresh call
 * the AuthCoordinator makes reaches this fixture's mock instead of the
 * network.
 */
export const auth0MockProviderFixture: SsoProviderFixture = {
  name: 'Auth0 (mocked SDK)',
  slug: 'auth0-mock',
  clientType: 'public',
  loginKind: 'redirect',

  supportsCrossTab: true,
  supportsSelfSignup: false,
  supportsSilentCallback: false,

  isAvailable: () => true,

  signInButtonPattern: /sign in with (auth0|sso)/i,

  async configureBackend(apiContext: APIRequestContext) {
    const snapshot = await fetchSecurityConfig(apiContext);
    await applyProviderConfig(apiContext, snapshot, buildValidConfig());

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
    await applyProviderConfig(apiContext, snapshot, buildBrokenConfig());

    return {
      restore: async () => {
        await restoreSecurityConfig(apiContext, snapshot);
      },
      expectedWarningPattern: /discoveryUri/,
    };
  },

  async performLogin(page: Page) {
    // Install the mock *before* the first navigation so cold-load sees
    // both `__omTestAuth0` and the seeded token on its first read.
    await installAuth0Mock(page);

    await page.goto('/');

    await expect(page.getByTestId('app-bar-item-my-data')).toBeVisible({
      timeout: 30_000,
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
