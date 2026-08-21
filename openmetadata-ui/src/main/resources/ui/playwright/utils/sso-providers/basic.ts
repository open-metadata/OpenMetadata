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
import { APIRequestContext, expect, Page } from '@playwright/test';
import {
  applyProviderConfig,
  fetchSecurityConfig,
  restoreSecurityConfig,
} from '../ssoAuth';
import { SsoBrokenConfigureResult, SsoProviderFixture } from './fixture';

// Static admin credentials used by every Basic-provider suite. The seeded
// database ships with this exact pair, so no per-run signup is needed.
const ADMIN_EMAIL = 'admin@openmetadata.org';
const ADMIN_PASSWORD = 'admin';

const buildValidConfig = () => ({
  authenticationConfiguration: {
    clientType: 'public',
    provider: 'basic',
    providerName: 'basic',
    publicKeyUrls: ['http://localhost:8585/api/v1/system/config/jwks'],
    tokenValidationAlgorithm: 'RS256',
    authority: 'https://openmetadata.org',
    clientId: 'openmetadata',
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
  // Missing `providerName` — validateAuthFields checks for this before any
  // client is instantiated, so the scenario 8 test can catch the specific
  // "required field missing" branch cleanly.
  delete (cfg.authenticationConfiguration as Record<string, unknown>)
    .providerName;

  return cfg;
};

/**
 * Basic (email+password) fixture. No external IdP — auth is fully handled
 * by the OpenMetadata backend, so `configureBackend` is a no-op restore
 * (backend already ships in Basic mode by default).
 *
 * `supportsCrossTab` is false because Basic issues one JWT per login and
 * the axios interceptor's own coalescing is exercised in Jest — the
 * cross-tab BroadcastChannel handshake specifically needs a provider that
 * mints tokens via a silent flow (OIDC/MSAL), so this fixture opts out.
 */
export const basicProviderFixture: SsoProviderFixture = {
  name: 'Basic (email/password)',
  slug: 'basic',
  clientType: 'public',
  loginKind: 'form',

  supportsCrossTab: false,
  supportsSelfSignup: false,
  supportsSilentCallback: false,

  isAvailable: () => true, // Always available — no external deps

  signInButtonPattern: /sign in/i,

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
      // The validator (added in commit 9) must name the missing field so
      // engineers see *what* is wrong before the IdP throws a cryptic error.
      expectedWarningPattern: /providerName/,
    };
  },

  async performLogin(page: Page) {
    await page.goto('/signin');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page
      .getByRole('button', { name: /^(sign in|log in)$/i })
      .click();
    // Authenticated app renders the sidebar's home nav; wait for it before
    // returning so downstream assertions can rely on isAuthenticated=true.
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
    // Clobber `exp` claim in the stored JWT so the coordinator's next
    // decode sees it as expired. Same technique the SilentRefresh spec
    // uses on the refactor branch — kept here so per-provider fixtures
    // stay self-contained.
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
