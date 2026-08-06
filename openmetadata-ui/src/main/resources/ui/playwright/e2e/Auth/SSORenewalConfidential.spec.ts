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
import { BrowserContext, expect, Page, Response, test } from '@playwright/test';
import { SSO_ENV } from '../../constant/ssoAuth';
import {
  AUTH_REFRESH_PATH,
  clearServerSessionCookie,
  decodeJwtExp,
  SHORT_ACCESS_TTL_SECONDS,
  waitForAccessTokenExpiry,
  withShortOidcTokenValidity,
} from '../../utils/sessionRenewal';
import { keycloakOidcConfidentialProviderHelper } from '../../utils/sso-providers/keycloak-oidc';
import {
  swapSecurityConfig,
} from '../../utils/ssoAuth';
import { loginViaSso } from '../../utils/ssoLogin';
import { getToken } from '../../utils/tokenStorage';

// Confidential-client OIDC renewal against the local Keycloak fixture.
//
// This is the only confidential coverage that runs anywhere in CI. The Java ITs
// have confidential backends but nothing sets jpw.auth, and the mock-oidc
// Playwright suite is referenced by no workflow — so AuthenticationCodeFlowHandler
// (handleLogin, handleCallback, handleRefresh) is otherwise exercised only by
// mocked unit tests. Simply reaching the first assertion here walks the whole
// server-side code flow: authorize, callback, code exchange, session, refresh.
//
// Keycloak rather than Okta because the fixture is the tenant: the client secret
// is a committed throwaway and the realm is ours, so no external app registration
// has to be provisioned before this can run. clientType: 'confidential' is what
// makes AuthProvider mount GenericAuthenticator, moving renewal onto
// GET /api/v1/auth/refresh — the same transport SSORenewal.spec.ts asserts for
// SAML, but reached through a completely different handler.
//
// Tagged @tokenRenewal, which is accurate — it shortens
// oidcConfiguration.tokenValidity — and lands it on exactly the leg that can run
// it: the okta leg excludes that tag (no confidential app there) and the
// -crosssite leg excludes it too, leaving keycloak-azure-saml.
const CONFIDENTIAL_RENEWAL_TAGS = ['@sso', '@Platform', '@tokenRenewal'];

const username = process.env[SSO_ENV.USERNAME] ?? '';
const password = process.env[SSO_ENV.PASSWORD] ?? '';

test.describe.configure({ mode: 'serial' });

test.describe('Confidential OIDC Session Renewal', {
  tag: CONFIDENTIAL_RENEWAL_TAGS,
}, () => {
  test.slow();
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(
    !username || !password,
    `Requires ${SSO_ENV.USERNAME}/${SSO_ENV.PASSWORD}`
  );

  const helper = keycloakOidcConfidentialProviderHelper;
  let restoreSecurity: (() => Promise<void>) | undefined;
  let userContext: BrowserContext | undefined;
  let userPage: Page | undefined;

  test.beforeAll(
    'Swap server to confidential OIDC with a short JWT TTL and sign in',
    async ({ browser }) => {
      restoreSecurity = await swapSecurityConfig(
        browser,
        withShortOidcTokenValidity(await helper.buildConfigPayload())
      );

      userContext = await browser.newContext();
      userPage = await userContext.newPage();
      await loginViaSso(userPage, helper, { username, password });
    }
  );

  test.afterAll('Restore original security configuration', async () => {
    await userPage?.close();
    await userContext?.close();
    await restoreSecurity?.();
  });

  test('should silently refresh the OpenMetadata token after expiry', async () => {
    const page = userPage!;

    await expect(page.getByTestId('dropdown-profile')).toBeVisible();

    const initialAccessToken = await getToken(page);
    const initialExp = decodeJwtExp(initialAccessToken);

    await waitForAccessTokenExpiry(SHORT_ACCESS_TTL_SECONDS);

    // 200 specifically: handleRefresh answers a concurrent refresh with 503 +
    // Retry-After, which must not satisfy the wait.
    const refreshResponsePromise = page.waitForResponse(
      (r) => r.url().includes(AUTH_REFRESH_PATH) && r.status() === 200,
      { timeout: 15_000 }
    );

    await page.getByTestId('app-bar-item-explore').click();

    const refreshResponse = await refreshResponsePromise;

    await expect(page.getByTestId('dropdown-profile')).toBeVisible();

    const newAccessToken = await getToken(page);

    expect(refreshResponse.status()).toBe(200);
    expect(newAccessToken).not.toBe(initialAccessToken);
    expect(decodeJwtExp(newAccessToken)).toBeGreaterThan(initialExp);
    expect(page.url()).not.toContain('/signin');
  });

  test('should queue concurrent 401s behind a single refresh call', async () => {
    const page = userPage!;

    await expect(page.getByTestId('dropdown-profile')).toBeVisible();

    await page.getByTestId('app-bar-item-my-data').click();
    await page.waitForURL('**/my-data');

    await waitForAccessTokenExpiry(SHORT_ACCESS_TTL_SECONDS);

    const refreshCalls: string[] = [];
    const trackRefresh = (response: Response): void => {
      if (response.url().includes(AUTH_REFRESH_PATH)) {
        refreshCalls.push(response.url());
      }
    };

    page.on('response', trackRefresh);

    try {
      const refreshResponsePromise = page.waitForResponse(
        (r) => r.url().includes(AUTH_REFRESH_PATH) && r.status() === 200,
        { timeout: 15_000 }
      );

      await page.getByTestId('app-bar-item-explore').click();
      await refreshResponsePromise;
      await expect(page.getByTestId('dropdown-profile')).toBeVisible();
    } finally {
      page.off('response', trackRefresh);
    }

    expect(refreshCalls).toHaveLength(1);
    expect(page.url()).not.toContain('/signin');
  });

  test('should force re-login when the OpenMetadata session is gone', async () => {
    const page = userPage!;

    // Without OM_SESSION, acquireRefreshLease finds nothing and handleRefresh
    // answers 401 {"error":"No active session"} — the confidential-client
    // equivalent of the IdP refusing a silent renewal.
    await clearServerSessionCookie(userContext!);
    await waitForAccessTokenExpiry(SHORT_ACCESS_TTL_SECONDS);

    await page.reload();

    await page.waitForURL('**/signin', { timeout: 30_000 });
    await expect(page.getByText(/session has timed out/i)).toBeVisible();
    await expect(page.locator('button.signin-button')).toBeVisible();
  });
});
