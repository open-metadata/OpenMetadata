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

// Confidential OIDC renewal: clientType 'confidential' mounts
// GenericAuthenticator, so renewal goes to GET /api/v1/auth/refresh through
// AuthenticationCodeFlowHandler — the same transport SSORenewal asserts for SAML,
// via a different handler. Keycloak rather than Okta because the fixture is the
// tenant; a confidential Okta app is blocked by its Okta Verify enrollment policy.
//
// @tokenRenewal lands it on the one leg that can serve it: okta and -crosssite
// both exclude that tag.
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

    // 200 only: a concurrent refresh answers 503 + Retry-After.
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

    await clearServerSessionCookie(userContext!);
    await waitForAccessTokenExpiry(SHORT_ACCESS_TTL_SECONDS);

    await page.reload();

    await page.waitForURL('**/signin', { timeout: 30_000 });
    await expect(page.getByText(/session has timed out/i)).toBeVisible();
    await expect(page.locator('button.signin-button')).toBeVisible();
  });
  }
);
