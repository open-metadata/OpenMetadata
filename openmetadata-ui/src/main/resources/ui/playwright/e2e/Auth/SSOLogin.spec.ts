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
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { SSO_ENV } from '../../constant/ssoAuth';
import { performAdminLogin } from '../../utils/admin';
import { getAuthContext, redirectToHomePage } from '../../utils/common';
import { getProviderHelper, ProviderHelper } from '../../utils/sso-providers';
import {
  applyProviderConfig,
  fetchSecurityConfig,
  restoreSecurityConfig,
  SecurityConfigSnapshot,
  verifyLoggedInUserMatches,
} from '../../utils/ssoAuth';
import { getToken } from '../../utils/tokenStorage';

const providerType = process.env[SSO_ENV.PROVIDER_TYPE] ?? '';
const username = process.env[SSO_ENV.USERNAME] ?? '';
const password = process.env[SSO_ENV.PASSWORD] ?? '';

test.describe('SSO Login', { tag: ['@sso', '@Platform'] }, () => {
  test.slow();
  // eslint-disable-next-line playwright/no-skipped-test -- conditional skip on required env vars; the suite only runs when SSO credentials are provided by CI or the developer
  test.skip(
    !providerType || !username || !password,
    `${SSO_ENV.PROVIDER_TYPE}, ${SSO_ENV.USERNAME}, and ${SSO_ENV.PASSWORD} env vars must be set`
  );

  test.describe.configure({ mode: 'serial' });

  let helper: ProviderHelper;
  let adminJwt: string | undefined;
  let originalSecurityConfig: SecurityConfigSnapshot | undefined;
  let userContext: BrowserContext | undefined;
  let userPage: Page | undefined;

  test.beforeAll(
    'Swap OpenMetadata server to target SSO provider',
    async ({ browser }) => {
      helper = getProviderHelper(providerType);
      const { apiContext, afterAction, page } = await performAdminLogin(
        browser
      );

      try {
        adminJwt = await getToken(page);

        if (!adminJwt) {
          throw new Error(
            'Failed to capture admin JWT before SSO swap — aborting to avoid leaving server in SSO mode'
          );
        }

        originalSecurityConfig = await fetchSecurityConfig(apiContext);
        const providerConfig = await helper.buildConfigPayload();

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

  test('should display SSO sign-in button on /signin', async ({ page }) => {
    await page.goto('/signin');

    await expect(page.getByTestId('login-form-container')).toBeVisible();

    const signInButton = page.locator('button.signin-button');

    await expect(signInButton).toBeVisible();
    await expect(signInButton).toContainText(helper.expectedButtonText);
    await expect(page.getByTestId('email')).toHaveCount(0);
  });

  test('should complete full SSO login and verify user session', async () => {
    const page = userPage!;

    await test.step('Click SSO button and redirect to IdP', async () => {
      await page.goto('/signin');

      const signInButton = page.locator('button.signin-button');

      await expect(signInButton).toBeVisible();
      await signInButton.click();
      await page.waitForURL(helper.loginUrlPattern, { timeout: 45_000 });
    });

    await test.step('Authenticate at the identity provider', async () => {
      await helper.performProviderLogin(page, { username, password });
    });

    await test.step('Return to OpenMetadata and complete self-signup if needed', async () => {
      await page.waitForURL(
        (url) =>
          url.pathname.endsWith('/signup') || url.pathname.endsWith('/my-data'),
        { timeout: 60_000 }
      );

      if (page.url().includes('/signup')) {
        const createButton = page.getByRole('button', { name: /create/i });

        await expect(createButton).toBeEnabled();
        await createButton.click();
        await page.waitForURL('**/my-data', { timeout: 60_000 });
      }

      await redirectToHomePage(page);
    });

    await test.step('Verify JWT against loggedInUser API', async () => {
      await verifyLoggedInUserMatches(page, username);
    });
  });

  test('should keep the session after a page reload', async () => {
    const page = userPage!;

    await page.reload();
    await page.waitForURL('**/my-data', { timeout: 30_000 });
    await expect(page.getByTestId('dropdown-profile')).toBeVisible();
    await verifyLoggedInUserMatches(page, username);
  });

  test('should share the session with a new page in the same context', async () => {
    const extraPage = await userContext!.newPage();

    try {
      await extraPage.goto('/');
      await extraPage.waitForURL('**/my-data', { timeout: 30_000 });
      await expect(extraPage.getByTestId('dropdown-profile')).toBeVisible();
      await verifyLoggedInUserMatches(extraPage, username);
    } finally {
      await extraPage.close();
    }
  });

  test('should sign out and return to /signin', async () => {
    const page = userPage!;

    await page.getByRole('menuitem', { name: /logout/i }).click();

    const confirmLogoutButton = page.getByTestId('confirm-logout');

    await expect(confirmLogoutButton).toBeVisible();
    await expect(confirmLogoutButton).toBeEnabled();
    await confirmLogoutButton.click();

    await page.waitForURL('**/signin', { timeout: 30_000 });

    await expect(page.locator('button.signin-button')).toBeVisible();
  });

  test('should stay signed-out after refreshing', async () => {
    const page = userPage!;

    await page.reload();
    await page.waitForURL('**/signin', { timeout: 30_000 });
    await expect(page.locator('button.signin-button')).toBeVisible();
    await expect(page.getByTestId('dropdown-profile')).toHaveCount(0);
  });
});
