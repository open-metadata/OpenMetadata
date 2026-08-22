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
  restoreSecurityConfig,
} from '../ssoAuth';
import { SsoBrokenConfigureResult, SsoProviderFixture } from './fixture';
import { mintMockJwt } from './mock-token';

// Deterministic identity for the mocked login. Matches an admin the seeded
// database recognises so the /users/loggedInUser fetch succeeds after
// isAuthenticated flips true.
const MOCK_EMAIL = 'admin@openmetadata.org';
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
    principalDomain: 'openmetadata.org',
    adminPrincipals: ['admin'],
  },
});

const buildBrokenConfig = () => {
  const cfg = buildValidConfig();
  // Drop `clientId` from `oidcConfiguration` per the fixture contract — the
  // client-side validator must name this exact missing field before any
  // MSAL client is instantiated.
  const oidcConfig: Record<string, unknown> = {
    id: MOCK_CLIENT_ID,
    type: 'azure',
    scope: 'openid email profile',
    callbackUrl: 'http://localhost:8585/callback',
    responseType: 'code',
  };
  // Intentionally omit clientId here.
  delete oidcConfig.clientId;
  (
    cfg.authenticationConfiguration as Record<string, unknown>
  ).oidcConfiguration = oidcConfig;
  // Also drop the top-level clientId to make the missing-field branch
  // reachable regardless of which layer the validator inspects first.
  delete (cfg.authenticationConfiguration as Record<string, unknown>).clientId;

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
const installMsalMock = async (page: Page): Promise<void> => {
  const idToken = mintMockJwt({
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
      const instance = {
        handleRedirectPromise: async () => ({
          idToken,
          accessToken: idToken,
          account,
          expiresOn: mintFreshExpiresOn(),
        }),
        acquireTokenSilent: async () => ({
          idToken,
          accessToken: idToken,
          account,
          expiresOn: mintFreshExpiresOn(),
        }),
        acquireTokenPopup: async () => ({
          idToken,
          accessToken: idToken,
          account,
          expiresOn: mintFreshExpiresOn(),
        }),
        loginRedirect: async () => {
          // Simulate the return-from-IdP hop — the router picks up `/callback`
          // and the AuthProvider's redirect-completion effect finishes login.
          window.location.href =
            window.location.origin + '/callback#code=msal-mock';

          return undefined;
        },
        loginPopup: async () => ({
          idToken,
          accessToken: idToken,
          account,
          expiresOn: mintFreshExpiresOn(),
        }),
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

      // Cold-load path: AuthCoordinator reads this key on boot and, when
      // present + unexpired, flips isAuthenticated true without ever
      // touching the (mocked) SDK.
      localStorage.setItem('oidcIdToken', idToken);
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

  isAvailable: () => true,

  signInButtonPattern: /sign in with (azure|microsoft|sso)/i,

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
      expectedWarningPattern: /clientId/,
    };
  },

  async performLogin(page: Page) {
    // The mock must be installed *before* the first navigation so the
    // AuthCoordinator's cold-load hook sees both `__omTestMsal` and the
    // seeded token on its very first read.
    await installMsalMock(page);

    await page.goto('/');

    // Authenticated app renders the sidebar's home nav. Same waypoint
    // basic.ts uses — keeps downstream assertions provider-agnostic.
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
    // Same JWT-mangle technique as basic.ts — mangle `exp` in the stored
    // token so the coordinator's next decode sees it as expired and calls
    // into the mock's `acquireTokenSilent`, which mints a fresh JWT.
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
