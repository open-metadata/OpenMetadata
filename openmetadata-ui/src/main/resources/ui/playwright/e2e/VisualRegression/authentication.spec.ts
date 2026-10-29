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
import { expect, test } from '../../support/fixtures/base';
import { installVisualBootstrap } from '../../utils/visualData';
import {
  expectVisualScreenshot,
  gotoForScreenshot,
  prepareVisualTheme,
} from '../../utils/visualRegression';

test.describe('Public authentication', { tag: '@Platform' }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeEach(async ({ page }) => {
    // Public routes use the Classic shell, whose theme provider is light-only.
    await prepareVisualTheme(page, 'light', 'classic');
    await installVisualBootstrap(page, 'classic');
    await page.route('**/api/v1/users/registrationConfirmation**', (route) =>
      route.fulfill({
        status: 400,
        json: { message: 'This activation token has expired.' },
      })
    );
  });
  for (const [id, path, ready, submit] of [
    ['sign-in', '/signin', 'login-form-container', 'login'],
    ['sign-up', '/register', 'create-account', 'create-account'],
    [
      'forgot-password',
      '/forgot-password',
      'forgot-password-container',
      'submit-button',
    ],
    [
      'reset-password',
      '/users/password/reset?token=visual-expired-token',
      'reset-password-container',
      'submit-button',
    ],
  ] as const) {
    test(`${id} form and required validation`, async ({ page }) => {
      await gotoForScreenshot(page, path, { readyTestId: ready });
      const form =
        id === 'sign-up'
          ? page
              .locator('form')
              .filter({ has: page.getByTestId('create-account') })
          : page.getByTestId(ready);
      await expectVisualScreenshot(page, `auth-${id}`, 'light', {
        target: form,
      });
      await page.getByTestId(submit).click();
      await expect(form.locator('[aria-invalid="true"]')).not.toHaveCount(0);
      await expectVisualScreenshot(page, `auth-${id}-validation`, 'light', {
        target: form,
      });
    });
  }
  test('expired activation token', async ({ page }) => {
    await gotoForScreenshot(
      page,
      '/users/registrationConfirmation?token=visual-expired-token',
      { readyTestId: 'account-activation-container' }
    );
    await expect(page.getByTestId('regenerate-token')).toBeVisible();
    await expectVisualScreenshot(page, 'auth-expired-activation', 'light', {
      allowErrorFeedback: true,
    });
  });
  test('unknown public route', async ({ page }) => {
    await gotoForScreenshot(page, '/404', { readyTestId: 'no-page-found' });
    await expectVisualScreenshot(page, 'auth-not-found', 'light');
  });
});
