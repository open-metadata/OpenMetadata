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
import { performAdminLogin } from '../../utils/admin';
import { getAuthContext } from '../../utils/common';
import {
  AUTH_REFRESH_PATH,
  clearSamlSessionCookie,
  decodeJwtExp,
  SHORT_ACCESS_TTL_SECONDS,
  waitForAccessTokenExpiry,
  withShortSamlTokenValidity,
} from '../../utils/sessionRenewal';
import { getProviderHelper, ProviderHelper } from '../../utils/sso-providers';
import {
  applyProviderConfig,
  fetchSecurityConfig,
  restoreSecurityConfig,
  SecurityConfigSnapshot,
} from '../../utils/ssoAuth';
import { loginViaSso } from '../../utils/ssoLogin';
import { getToken } from '../../utils/tokenStorage';

const providerType = process.env[SSO_ENV.PROVIDER_TYPE] ?? '';
const username = process.env[SSO_ENV.USERNAME] ?? '';
const password = process.env[SSO_ENV.PASSWORD] ?? '';

const SESSION_RENEWAL_TAGS = ['@sso', '@Platform', '@tokenRenewal'];

test.describe.configure({ mode: 'serial' });

test.describe('SSO Session Renewal', { tag: SESSION_RENEWAL_TAGS }, () => {
  test.slow();
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(
    !username || !password,
    `${SSO_ENV.USERNAME} + ${SSO_ENV.PASSWORD} must be set`
  );

  let helper: ProviderHelper;
  let adminJwt: string | undefined;
  let originalSecurityConfig: SecurityConfigSnapshot | undefined;
  let userContext: BrowserContext | undefined;
  let userPage: Page | undefined;

  test.beforeAll(
    'Swap server to SAML with short JWT TTL and establish user session',
    async ({ browser }) => {
      helper = getProviderHelper(providerType);
      const { apiContext, afterAction, token } = await performAdminLogin(
        browser
      );

      try {
        adminJwt = token;

        if (!adminJwt) {
          throw new Error(
            'Failed to capture admin JWT before SSO swap — aborting to avoid leaving server in SSO mode'
          );
        }

        originalSecurityConfig = await fetchSecurityConfig(apiContext);
        const providerConfig = withShortSamlTokenValidity(
          await helper.buildConfigPayload()
        );

        await applyProviderConfig(
          apiContext,
          originalSecurityConfig,
          providerConfig
        );
      } finally {
        await afterAction();
      }

      userContext = await browser.newContext();
      userPage = await userContext.newPage();
      await loginViaSso(userPage, helper, { username, password });
    }
  );

  test.afterAll('Restore original security configuration', async () => {
    await userPage?.close();
    await userContext?.close();

    if (!adminJwt || !originalSecurityConfig) {
      return;
    }

    const adminContext = await getAuthContext(adminJwt);

    try {
      await restoreSecurityConfig(adminContext, originalSecurityConfig);
    } finally {
      await adminContext.dispose();
    }
  });

  test('should silently refresh the access token after expiry', async () => {
    const page = userPage!;
    await expect(page.getByTestId('dropdown-profile')).toBeVisible();

    const initialAccessToken = await getToken(page);
    const initialExp = decodeJwtExp(initialAccessToken);

    await waitForAccessTokenExpiry(SHORT_ACCESS_TTL_SECONDS);

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

  test('should force re-login when the SAML session is gone', async () => {
    const page = userPage!;

    await clearSamlSessionCookie(userContext!);
    await waitForAccessTokenExpiry(SHORT_ACCESS_TTL_SECONDS);

    await page.reload();

    await page.waitForURL('**/signin', { timeout: 30_000 });
    await expect(page.getByText(/session has timed out/i)).toBeVisible();
    await expect(page.locator('button.signin-button')).toBeVisible();
  });
});
