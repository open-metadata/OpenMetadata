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
import {
  loginViaSso,
  SSO_LOGIN_HOOK_TIMEOUT_MS,
} from '../../utils/ssoLogin';
import { getToken } from '../../utils/tokenStorage';

const username = process.env[SSO_ENV.USERNAME] ?? '';
const password = process.env[SSO_ENV.PASSWORD] ?? '';

// Confidential-client OIDC renewal — the flow most self-hosted deployments run,
// and the one with no CI coverage at all before this suite. The Java ITs carry
// confidential backends but nothing sets jpw.auth, and the mock-oidc Playwright
// suite is referenced by no workflow, so AuthenticationCodeFlowHandler
// (handleLogin, handleCallback, handleRefresh) is otherwise exercised only by
// mocked unit tests. Reaching the first assertion here walks the whole
// server-side code flow: authorize, callback, code exchange, session, refresh.
//
// clientType: 'confidential' is what makes AuthProvider mount
// GenericAuthenticator, moving renewal onto GET /api/v1/auth/refresh — the same
// transport SSORenewal.spec.ts asserts for SAML, reached through a different
// handler. So the assertions match that suite; only the IdP differs.
//
// Keycloak rather than Okta, and deliberately only Keycloak. AuthProvider
// branches on clientType rather than provider, so either IdP exercises the exact
// same OpenMetadata code — and only the Keycloak fixture can actually run it. A
// confidential Okta app is governed by an authentication policy that requires
// Okta Verify enrollment, which parks the login on Okta's "Set up security
// methods" screen and never returns to OpenMetadata (see run 31092281732). The
// fixture is the tenant here, so its client secret is a committed throwaway and
// there is no external registration or enrollment policy in the way.
//
// Tagged @tokenRenewal: accurate, since it shortens
// oidcConfiguration.tokenValidity, and it lands the suite on the one leg that can
// serve it — the okta and -crosssite legs both exclude that tag.
const CONFIDENTIAL_RENEWAL_TAGS = ['@sso', '@Platform', '@tokenRenewal'];

test.describe.configure({ mode: 'serial' });

test.describe(
  'Confidential OIDC Session Renewal',
  { tag: CONFIDENTIAL_RENEWAL_TAGS },
  () => {
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
      test.setTimeout(SSO_LOGIN_HOOK_TIMEOUT_MS);

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
  }
);
