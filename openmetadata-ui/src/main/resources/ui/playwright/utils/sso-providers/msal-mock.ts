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
// Azure AD (MSAL) fixture that mocks the SDK at the browser-context level.
//
// Design choice — test-hook over exposeBinding
// --------------------------------------------
// The fixture ships a mock MSAL context via `page.addInitScript` under
// `window.__omTestMsal`; `MsalAuthenticator.tsx` reads it in dev/test mode
// (behind `import.meta.env.MODE !== 'production'`) and uses it instead of
// `useMsal()`'s real value. `page.exposeBinding` was the other option, but it
// forces a Node ↔ page hop on every SDK call — turning the synchronous
// `useMsal()` read into a Promise chain and blowing up the component's
// `useEffect` sequencing. A pure-in-page shim keeps the shape identical to
// what `@azure/msal-react` returns, so the code under test can't tell the
// difference.
//
// The `MsalProvider` in `AuthProvider.tsx` still mounts a real
// `PublicClientApplication` from the backend-supplied config — that keeps the
// authenticator's Rules-of-Hooks contract intact. Only the *return value* of
// `useMsal()` is swapped; the react-msal wiring still runs.
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

// The `configureBackend` step mints an admin Personal Access Token here
// (before the provider swap) and `performLogin` reads it back. A PAT
// carries no `sessionId`, so `JwtFilter.validateSessionBoundToken`
// short-circuits before the provider check — meaning it stays valid
// after the config swap to Azure/MSAL. It's also signed by OM's own
// JWKS, which we keep in `publicKeyUrls` on every fixture — so
// `/users/loggedInUser` returns 200 instead of 401 on the mocked
// login. Without this, the mock JWT (via `mintMockJwt`) is signed
// with a throwaway key the server rejects and the sidebar never
// renders — every scenario 1-6 timed out on this leg pre-round-10.
let adminPat: string | null = null;

// Deterministic identity for the mocked login. Matches an admin the seeded
// database recognises so the /users/loggedInUser fetch succeeds after
// isAuthenticated flips true.
// Must be the seeded admin's actual email (hyphenated domain) so the
// SPA's post-mock-login GET /users/loggedInUser resolves — mismatched
// email produces a valid JWT but a 404 on user lookup, visible in CI
// as a sidebar-timeout on scenario 1.
const MOCK_EMAIL = 'admin@open-metadata.org';
const MOCK_NAME = 'MSAL Mock Admin';
const MOCK_SUB = 'msal-mock-admin';
const MOCK_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_CLIENT_ID = 'msal-mock-client';

// 5 minutes — matches the default MSAL access-token lifetime the renewer
// path expects. Small enough that `forceTokenExpiry` doesn't collide with
// the real "token still valid" branch.
const TOKEN_LIFETIME_SECONDS = 300;

const buildValidConfig = () => ({
  authenticationConfiguration: {
    clientType: 'public',
    provider: 'azure',
    providerName: 'Azure AD (mocked)',
    publicKeyUrls: ['http://localhost:8585/api/v1/system/config/jwks'],
    tokenValidationAlgorithm: 'RS256',
    // Realistic-looking authority — MSAL's `PublicClientApplication.initialize`
    // does not hit the network, so an unreachable tenant is fine; the mock
    // intercepts every call that would otherwise leave the page.
    authority: `https://login.microsoftonline.com/${MOCK_TENANT_ID}`,
    clientId: MOCK_CLIENT_ID,
    callbackUrl: 'http://localhost:8585/callback',
    jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
    enableSelfSignup: false,
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
 * Installs the `window.__omTestMsal` shim + a valid stored token before the
 * app mounts. `MsalAuthenticator` picks up the shim on first render and
 * uses it in place of `useMsal()`.
 *
 * Runs as a page init script so it fires before *any* app JS — including the
 * AuthCoordinator's cold-load check that reads the token out of storage.
 */
const installMsalMock = async (
  page: Page,
  overrideIdToken?: string
): Promise<void> => {
  // Prefer the real admin PAT minted in `configureBackend` — it's signed
  // by OM's own JWKS so `/users/loggedInUser` accepts it. Fall back to the
  // mock-minted throwaway JWT only for tests that call `installMsalMock`
  // outside the scenario matrix (none today; the fallback is defensive).
  const idToken =
    overrideIdToken ??
    mintMockJwt({
      email: MOCK_EMAIL,
      name: MOCK_NAME,
      sub: MOCK_SUB,
      expInSeconds: TOKEN_LIFETIME_SECONDS,
    });

  await page.addInitScript(
    ({ idToken, email, name, sub, lifetimeSeconds, tenantId }) => {
      const account = {
        homeAccountId: `${sub}.${tenantId}`,
        environment: 'login.microsoftonline.com',
        tenantId,
        username: email,
        localAccountId: sub,
        name,
      };

      const mintFreshExpiresOn = () =>
        new Date(Date.now() + lifetimeSeconds * 1000);

      // The mock instance mirrors the subset of `IPublicClientApplication`
      // the authenticator actually calls. Everything else is intentionally
      // absent so an unmocked path throws loudly rather than silently
      // succeeding with `undefined`.
      // `parseMSALResponse` in AuthProvider.util destructures `scopes` and
      // calls `scopes.join(',')` unconditionally, so every `AuthenticationResult`
      // the mock returns MUST include the field. Previously we omitted it,
      // which threw `undefined.join is not a function` inside MsalAuthenticator's
      // `handleRedirect` -> caught -> `handleFailedLogin()` -> `navigate(SIGNIN)`.
      // Scenario 1 raced and caught the brief pre-throw authenticated frame
      // where sidebar was visible; scenarios 2/4/6 did not. Reuse a single
      // constant so the shape stays consistent across every mock method.
      const RESPONSE_SCOPES = ['openid', 'profile', 'email'];
      const mintResponse = () => ({
        idToken,
        accessToken: idToken,
        account,
        expiresOn: mintFreshExpiresOn(),
        scopes: RESPONSE_SCOPES,
      });

      const instance = {
        handleRedirectPromise: async () => mintResponse(),
        acquireTokenSilent: async () => mintResponse(),
        acquireTokenPopup: async () => mintResponse(),
        loginRedirect: async () => {
          // Simulate the return-from-IdP hop — the router picks up `/callback`
          // and the AuthProvider's redirect-completion effect finishes login.
          window.location.href =
            window.location.origin + '/callback#code=msal-mock';

          return undefined;
        },
        loginPopup: async () => mintResponse(),
        // No-ops the authenticator's `useEffect` chain expects.
        initialize: async () => undefined,
        addEventCallback: () => 'mock-event-callback-id',
        removeEventCallback: () => undefined,
        enableAccountStorageEvents: () => undefined,
        disableAccountStorageEvents: () => undefined,
        getAllAccounts: () => [account],
        getActiveAccount: () => account,
        setActiveAccount: () => undefined,
      };

      (window as unknown as { __omTestMsal: unknown }).__omTestMsal = {
        instance,
        accounts: [account],
        // Matches @azure/msal-browser InteractionStatus.None — string literal
        // is stable across msal-browser versions and avoids importing the
        // enum at page-script scope.
        inProgress: 'none',
        logger: undefined,
      };

      // Cold-load path: AuthCoordinator reads the token from
      // `app_state.primary` in IndexedDB via the app-worker service worker
      // (see SwTokenStorage / SwTokenStorageUtils). The `oidcIdToken`
      // localStorage key hasn't been the token store since the SW rewrite
      // — writing it here is a no-op. Seed IndexedDB directly so
      // `getOidcToken()` resolves to a valid Bearer on first render, before
      // the SW is even registered (the SW's `get` handler falls through to
      // IndexedDB when its in-memory swStore misses).
      // Fire-and-forget: init-scripts don't await; the DB write races the
      // SPA boot, and on Chromium indexedDB opens are fast enough that
      // `getOidcToken` (also async) resolves after our put completes. If
      // it doesn't, the SPA re-renders once the token becomes available.
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
      // Expose the seed promise so the AuthProvider can await it before
      // reading the token (kept as a defensive hook — not currently
      // consumed by production code).
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
      tenantId: MOCK_TENANT_ID,
    }
  );
};

/**
 * Azure AD fixture that mocks `@azure/msal-react`'s `useMsal()` return value
 * at the page-context level. Exercises `MsalAuthenticator.tsx` end-to-end —
 * cold-load recognises the pre-seeded token, and any silent-refresh call the
 * AuthCoordinator makes reaches this fixture's mock instead of the network.
 */
export const msalMockProviderFixture: SsoProviderFixture = {
  name: 'Azure AD (MSAL, mocked SDK)',
  slug: 'msal-mock',
  clientType: 'public',
  loginKind: 'redirect',

  supportsCrossTab: true,
  supportsSelfSignup: false,
  supportsSilentCallback: false,
  usesBackendRefresh: false,

  isAvailable: () => true,

  signInButtonPattern: /sign in with (azure|microsoft|sso)/i,

  async configureBackend(apiContext: APIRequestContext) {
    // Mint a PAT BEFORE the swap (see the module-level comment). Non-fatal:
    // if it fails, `performLogin` falls back to the throwaway mock JWT and
    // the sidebar-timeout re-appears, which is what we had pre-round-10.
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
    // The mock must be installed *before* the first navigation so the
    // AuthCoordinator's cold-load hook sees both `__omTestMsal` and the
    // seeded token on its very first read. Pass in the admin PAT minted
    // in `configureBackend` so the SPA-side JWT the server actually
    // sees is signed by OM's own JWKS — the mock-minted JWT gets
    // rejected on `/users/loggedInUser` (bad signature).
    await installMsalMock(page, adminPat ?? undefined);

    await page.goto('/');

    // Authenticated app renders the sidebar's home nav. Same waypoint
    // basic.ts uses — keeps downstream assertions provider-agnostic.
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
                __omTestMsal?: { instance?: unknown };
              }
            ).__omTestMsal?.instance !== undefined
        )
        .catch(() => false);
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
      const publicAuthCfg = await page.request
        .get('/api/v1/system/config/auth')
        .then(async (r) => `${r.status()} ${(await r.text()).slice(0, 500)}`)
        .catch((err) => `<request failed: ${(err as Error).message}>`);
      const bodyText = await page
        .locator('body')
        .innerText({ timeout: 2_000 })
        .catch(() => '<innerText failed>');

      throw new Error(
        `msal-mock performLogin: sidebar never appeared.\n` +
          `  page.url()                     = ${url}\n` +
          `  window.__omTestMsal present    = ${overrideProbe}\n` +
          `  IndexedDB app_state (first 60) = ${seedProbe}\n` +
          `  GET /users/loggedInUser        = ${loggedInUserResp}\n` +
          `  GET /system/config/auth        = ${publicAuthCfg}\n` +
          `  adminPat minted                = ${adminPat ? 'yes' : 'no'}\n` +
          `  body.innerText (first 300)     = ${bodyText.slice(0, 300)}\n` +
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
