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

import { expect, Page, test } from '@playwright/test';
import { AlertClass } from '../../../support/entity/AlertClass';
import { performAdminLogin } from '../../../utils/admin';
import { uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { enableAiAppMode } from '../../Utils/appMode';
import {
  expectSurfaceTheme,
  expectTheme,
  seedTheme,
  UiTheme,
} from '../../Utils/theme';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const THEMES: UiTheme[] = ['light', 'dark'];
// Settings pages are classic-only; AI mode reaches notification alerts in the
// settings modal (ADR:2026-10-21-settings-pages-are-classic-only).
const MODAL_ALERTS_ROUTE = '/my-data#notification/alerts';

const openAlertsList = async (page: Page) => {
  await page.goto(MODAL_ALERTS_ROUTE, { waitUntil: 'domcontentloaded' });
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('alerts-list-container')).toBeVisible();
};

const openAlertDetail = async (page: Page, alert: AlertClass) => {
  const detail = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/events/subscriptions/name/') &&
      response.request().method() === 'GET'
  );
  await page
    .getByTestId(`alert-${alert.responseData.displayName}`)
    .getByTestId('alert-name')
    .click();
  await detail;
  // The header actions render once the alert's permissions resolve.
  await expect(page.getByTestId('sync-alert-btn')).toBeVisible();
};

test.describe('AI mode — notification alerts live in the settings modal', () => {
  let alert: AlertClass;
  // Alerts created inside tests; afterAll removes any a failed test left behind
  // (already-deleted ones answer 404, which is fine).
  const testAlerts: AlertClass[] = [];

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // The list is name-sorted and cursor-paged; this prefix keeps the alert on page 1.
    alert = new AlertClass({
      alertType: 'Notification',
      name: `0%0-pw-ai-notification-${uuid()}`,
    });
    await alert.create(apiContext);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await alert?.delete(apiContext);
    for (const testAlert of testAlerts) {
      await testAlert.delete(apiContext);
    }

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await enableAiAppMode(page);
  });

  for (const theme of THEMES) {
    test(`a notification alert opens from the modal list (${theme})`, async ({
      page,
    }) => {
      await seedTheme(page, theme);
      await openAlertsList(page);

      const modal = page.getByTestId('ai-profile-page');
      const row = page.getByTestId(`alert-${alert.responseData.displayName}`);

      await expect(row).toBeVisible();
      await expect(
        page.getByTestId(`alert-delete-${alert.responseData.displayName}`)
      ).toBeEnabled();

      await openAlertDetail(page, alert);

      await expect(page).toHaveURL(/\/my-data#notification\/alerts\/.+/);
      await expect(page.getByTestId('edit-alert-btn')).toBeVisible();
      await expect(page.getByTestId('delete-alert-btn')).toBeVisible();

      await expectTheme(page, theme);
      await expectSurfaceTheme(modal, theme);
    });
  }

  test('the classic notification alert URLs are not served', async ({
    page,
  }) => {
    await page.goto('/settings/notifications/alerts', {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByTestId('ai-not-found-page')).toBeVisible();
    await expect(page.getByTestId('alerts-list-container')).not.toBeAttached();
  });

  test('deletes a notification alert from the modal details view', async ({
    browser,
    page,
  }) => {
    // Created per test so repeated runs in one worker each have an alert to delete.
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const deletableAlert = new AlertClass({
      alertType: 'Notification',
      name: `0%0-pw-ai-notification-delete-${uuid()}`,
    });
    await deletableAlert.create(apiContext);
    await afterAction();
    testAlerts.push(deletableAlert);

    await openAlertsList(page);
    await openAlertDetail(page, deletableAlert);

    await page.getByTestId('delete-alert-btn').click();

    const deleteResponse = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(
            `/api/v1/events/subscriptions/${deletableAlert.responseData.id}`
          ) && response.request().method() === 'DELETE'
    );
    await page.getByTestId('confirm-button').click();

    expect((await deleteResponse).status()).toBe(200);
    await expect(page).toHaveURL(/\/my-data#notification\/alerts$/);
    await expect(page.getByTestId('alerts-list-container')).toBeVisible();
    await expect(
      page.getByTestId(`alert-${deletableAlert.responseData.displayName}`)
    ).not.toBeAttached();
  });
});
