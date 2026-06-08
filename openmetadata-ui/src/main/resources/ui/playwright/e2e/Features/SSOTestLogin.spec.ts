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
import { Page } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';
import { enableSSOEditMode, selectSSOProvider } from '../../utils/sso';
import { test } from '../fixtures/pages';

const { expect } = test;

const VALIDATE_TOKEN_URL = '**/system/security/test-login/validate-token';

// Mirrors E2E_INJECTED_ID_TOKEN_KEY in
// src/components/SettingsSso/SsoTestLogin/useSsoTestLogin.ts. Injecting a token
// here lets the success/failure round-trip be exercised without a real IdP popup
// (which cannot run headlessly); the backend response is mocked separately.
const E2E_ID_TOKEN_KEY = '__OM_E2E_SSO_TEST_ID_TOKEN__';

// OIDC providers whose public-client login can be exercised end-to-end in the
// browser, so the interactive "Test Login" action is offered for them.
const OIDC_PROVIDERS = [
  'google',
  'okta',
  'auth0',
  'azure',
  'aws-cognito',
  'custom-oidc',
];

const switchToPublicClient = async (page: Page) => {
  const publicRadio = page.getByRole('radio', { name: /public/i });
  if ((await publicRadio.count()) > 0) {
    await publicRadio.click();
  }
};

const injectTestIdToken = (page: Page) =>
  page.evaluate((key) => {
    (window as unknown as Record<string, string>)[key] = 'e2e-fake-id-token';
  }, E2E_ID_TOKEN_KEY);

test.describe('SSO Test Login', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await enableSSOEditMode(page);
  });

  for (const provider of OIDC_PROVIDERS) {
    test(`should offer Test Login for ${provider} as a public client`, async ({
      page,
    }) => {
      await selectSSOProvider(page, provider);
      await switchToPublicClient(page);

      await expect(
        page.getByTestId('test-login-sso-configuration')
      ).toBeVisible();
    });
  }

  test('should not offer Test Login for a confidential client', async ({
    page,
  }) => {
    await selectSSOProvider(page, 'google');

    // Google defaults to the confidential client type.
    await expect(
      page.getByRole('radio', { name: /confidential/i })
    ).toBeChecked();
    await expect(
      page.getByTestId('test-login-sso-configuration')
    ).not.toBeVisible();
  });

  test('should not offer Test Login for SAML', async ({ page }) => {
    await selectSSOProvider(page, 'saml');

    await expect(
      page.getByTestId('test-login-sso-configuration')
    ).not.toBeVisible();
  });

  test('should not offer Test Login for LDAP', async ({ page }) => {
    await selectSSOProvider(page, 'ldap');

    await expect(
      page.getByTestId('test-login-sso-configuration')
    ).not.toBeVisible();
  });

  test('should show the resolved identity when the test login succeeds', async ({
    page,
  }) => {
    await page.route(VALIDATE_TOKEN_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          resolvedPrincipal: 'alice',
          resolvedEmail: 'alice@example.com',
          mappedRoles: ['DataConsumer'],
          mappedTeams: ['Engineering'],
          domainCheck: {
            enforced: true,
            principalDomain: 'example.com',
            resolvedDomain: 'example.com',
            passed: true,
          },
        }),
      })
    );

    await selectSSOProvider(page, 'google');
    await switchToPublicClient(page);
    await injectTestIdToken(page);

    const validateResponse = page.waitForResponse(VALIDATE_TOKEN_URL);
    await page.getByTestId('test-login-sso-configuration').click();
    await validateResponse;

    const dialog = page.getByRole('dialog');

    await expect(dialog.getByTestId('sso-test-login-details')).toBeVisible();
    await expect(dialog).toContainText('alice@example.com');
    await expect(dialog).toContainText('DataConsumer');
    await expect(dialog).toContainText('Engineering');
  });

  test('should show the failure reason when the configuration would reject the login', async ({
    page,
  }) => {
    await page.route(VALIDATE_TOKEN_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'failed',
          errors: [
            'The resolved identity does not satisfy the configured principal-domain rules.',
          ],
        }),
      })
    );

    await selectSSOProvider(page, 'google');
    await switchToPublicClient(page);
    await injectTestIdToken(page);

    const validateResponse = page.waitForResponse(VALIDATE_TOKEN_URL);
    await page.getByTestId('test-login-sso-configuration').click();
    await validateResponse;

    await expect(page.getByRole('dialog')).toContainText(
      /principal-domain rules/i
    );
  });
});
