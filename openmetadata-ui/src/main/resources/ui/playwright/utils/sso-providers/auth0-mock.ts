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
  mintAdminRestoreToken,
  restoreSecurityConfig,
} from '../ssoAuth';
import { SsoProviderFixture } from './fixture';
import { forceTokenExpiry } from './force-token-expiry';
import { mintMockJwt } from './mock-token';

// See msal-mock.ts for the full rationale — `configureBackend` mints an
// admin PAT (signed by OM's own JWKS, sessionless so it survives the
// provider swap) and `performLogin` passes it into `installAuth0Mock`
// so `/users/loggedInUser` accepts the SPA-side Bearer instead of
// rejecting the throwaway mock JWT.
let adminPat: string | null = null;

// Must be the seeded admin's actual email (hyphenated domain) so the
// SPA's post-mock-login GET /users/loggedInUser resolves — mismatched
// email produces a valid JWT but a 404 on user lookup, visible in CI
// as a sidebar-timeout on scenario 1.
const MOCK_EMAIL = 'admin@open-metadata.org';
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
      // Server-side schema (oidcClientConfig.json) makes `secret` and `tenant`
      // non-null even for public clients — the browser flow ignores them but
      // the PUT is rejected without them.
      secret: 'auth0-mock-secret',
      tenant: MOCK_DOMAIN,
      scope: 'openid email profile',
      discoveryUri: `https://${MOCK_DOMAIN}/.well-known/openid-configuration`,
      callbackUrl: 'http://localhost:8585/callback',
      responseType: 'code',
    },
  },
  authorizerConfiguration: {
    // Hyphenated to match the seeded admin's email domain — see MOCK_EMAIL.
    principalDomain: 'open-metadata.org',
    adminPrincipals: ['admin'],
  },
});

const buildBrokenConfig = () => {
  const cfg = buildValidConfig();
  // Set top-level clientId to '' — the client validator's `isFieldMissing`
  // flags empty strings as missing, but the server's Bean-Validation
  // accepts a non-null empty string, so the PUT still returns 200 and the
  // SPA gets to see the broken config. Deleting fields makes the server's
  // `@NotNull` reject the PUT before the client validator ever runs.
  (cfg.authenticationConfiguration as Record<string, unknown>).clientId = '';

  return cfg;
};

/**
 * Installs `window.__omTestAuth0` + a valid stored token before the app
 * mounts. `Auth0Authenticator` reads the shim on first render and uses it
 * in place of `useAuth0()`.
 */
const installAuth0Mock = async (
  page: Page,
  overrideIdToken?: string
): Promise<void> => {
  const idToken =
    overrideIdToken ??
    mintMockJwt({
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

      // Cold-load path: AuthCoordinator reads the token from
      // `app_state.primary` in IndexedDB via the app-worker service worker
      // (see SwTokenStorage / SwTokenStorageUtils). The `oidcIdToken`
      // localStorage key hasn't been the token store since the SW rewrite
      // — writing it here is a no-op. Seed IndexedDB directly so
      // `getOidcToken()` resolves to a valid Bearer on first render, before
      // the SW is even registered (the SW's `get` handler falls through to
      // IndexedDB when its in-memory swStore misses).
      const seedPromise = new Promise<void>((resolve) => {
        const req = indexedDB.open('AppDataStore', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('keyValueStore')) {
            db.createObjectStore('keyValueStore');
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['keyValueStore'], 'readwrite');
          tx.objectStore('keyValueStore').put(
            JSON.stringify({ primary: idToken }),
            'app_state'
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        };
        req.onerror = () => resolve();
      });
      (
        window as unknown as { __omTestSeedTokenPromise: Promise<void> }
      ).__omTestSeedTokenPromise = seedPromise;
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
  usesBackendRefresh: false,

  isAvailable: () => true,

  signInButtonPattern: /sign in with (auth0|sso)/i,

  async configureBackend(apiContext: APIRequestContext) {
    // Mint a PAT BEFORE the swap — signed by OM's JWKS so
    // `/users/loggedInUser` accepts the SPA-side Bearer instead of
    // rejecting the mock JWT. See module-level comment.
    try {
      adminPat = await mintAdminRestoreToken(apiContext);
    } catch {
      adminPat = null;
    }
    const snapshot = await fetchSecurityConfig(apiContext);
    await applyProviderConfig(apiContext, snapshot, buildValidConfig());

    return {
      restore: async () => {
        await restoreSecurityConfig(apiContext, snapshot);
      },
    };
  },

  async performLogin(page: Page) {
    // Install the mock *before* the first navigation so cold-load sees
    // both `__omTestAuth0` and the seeded token on its first read.
    // Pass the admin PAT from `configureBackend` so the SPA-side Bearer
    // is server-verifiable — see the module comment on `adminPat`.
    await installAuth0Mock(page, adminPat ?? undefined);

    await page.goto('/');

    try {
      await expect(page.getByTestId('app-bar-item-my-data')).toBeVisible({
        timeout: 30_000,
      });
    } catch (originalError) {
      const url = page.url();
      const overrideProbe = await page
        .evaluate(
          () =>
            (
              window as unknown as {
                __omTestAuth0?: { isAuthenticated?: boolean };
              }
            ).__omTestAuth0?.isAuthenticated
        )
        .catch(() => undefined);
      const seedProbe = await page
        .evaluate(async () => {
          try {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
              const req = indexedDB.open('AppDataStore', 1);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
            const value = await new Promise<unknown>((resolve, reject) => {
              const tx = db.transaction(['keyValueStore'], 'readonly');
              const req = tx.objectStore('keyValueStore').get('app_state');
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
            db.close();

            return typeof value === 'string'
              ? value.slice(0, 60)
              : String(value);
          } catch (err) {
            return `<idb read failed: ${(err as Error).message}>`;
          }
        })
        .catch(() => '<probe failed>');
      const loggedInUserResp = await page.request
        .get('/api/v1/users/loggedInUser?fields=profile')
        .then(async (r) => `${r.status()} ${(await r.text()).slice(0, 200)}`)
        .catch((err) => `<request failed: ${(err as Error).message}>`);
      const bodyText = await page
        .locator('body')
        .innerText({ timeout: 2_000 })
        .catch(() => '<innerText failed>');

      throw new Error(
        `auth0-mock performLogin: sidebar never appeared.\n` +
          `  page.url()                        = ${url}\n` +
          `  __omTestAuth0.isAuthenticated     = ${String(overrideProbe)}\n` +
          `  IndexedDB app_state (first 60)    = ${seedProbe}\n` +
          `  GET /users/loggedInUser           = ${loggedInUserResp}\n` +
          `  adminPat minted                   = ${adminPat ? 'yes' : 'no'}\n` +
          `  body.innerText (first 300)        = ${bodyText.slice(0, 300)}\n` +
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
