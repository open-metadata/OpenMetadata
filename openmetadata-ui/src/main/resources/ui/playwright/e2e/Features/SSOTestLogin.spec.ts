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

test.describe('SSO Test Login', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    // Prevent a real IdP popup from opening during the test. With no popup the
    // round-trip cannot complete, but the button/modal wiring is still asserted.
    await page.addInitScript(() => {
      window.open = () => null;
    });
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

  test('should open the Test Login modal when triggered', async ({ page }) => {
    await selectSSOProvider(page, 'google');
    await switchToPublicClient(page);

    await page.getByTestId('test-login-sso-configuration').click();

    // The modal opens immediately (before the popup round-trip resolves).
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText(/test login/i);
  });
});
