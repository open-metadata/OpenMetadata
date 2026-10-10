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
import { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '../../support/fixtures/base';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, toastNotification } from '../../utils/common';
import {
  selectScheduleDayOfWeek,
  selectScheduleFrequency,
  selectScheduleType,
} from '../../utils/scheduleInterval';
import { enableAiAppMode } from '../Utils/appMode';

test.use({ storageState: 'playwright/.auth/admin.json' });

// Seeded with every deployment and not touched by any other spec, so this file
// owns its lifecycle; afterAll reinstalls it if a step left it removed.
const APP_NAME = 'DataRetentionApplication';
const APP_CARD = 'data-retention-application-card';
const APP_API = `/api/v1/apps/name/${APP_NAME}`;

const ensureAppInstalled = async (apiContext: APIRequestContext) => {
  const response = await apiContext.get(`${APP_API}?include=all`);
  if (response.status() === 404) {
    const create = await apiContext.post('/api/v1/apps', {
      data: { name: APP_NAME },
    });
    expect(create.ok()).toBe(true);

    return;
  }
  const app = await response.json();
  if (app.deleted) {
    const restore = await apiContext.put('/api/v1/apps/restore', {
      data: { id: app.id },
    });
    expect(restore.ok()).toBe(true);
  }
};

const openApplications = async (page: Page) => {
  await enableAiAppMode(page);
  await redirectToHomePage(page);

  await expect(page.getByTestId('ask-ai-user-menu-trigger')).toBeVisible();

  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await expect(page.getByTestId('ai-profile-page')).toBeVisible();

  const appsResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/apps?') &&
      response.request().method() === 'GET'
  );
  await page.getByTestId('profile-nav-applications').click();
  await appsResponse;

  await expect(page.getByTestId('applications-panel')).toBeVisible();
};

const openAppDetail = async (page: Page) => {
  const appResponse = page.waitForResponse(
    (response) =>
      response.url().includes(APP_API) &&
      !response.url().includes('/status') &&
      response.request().method() === 'GET'
  );
  await page.getByTestId(APP_CARD).getByTestId('config-btn').click();
  await appResponse;

  await expect(page.getByTestId('app-detail')).toBeVisible();
};

const runManageAction = async (
  page: Page,
  action: 'disable' | 'restore' | 'uninstall'
) => {
  await page.getByTestId('manage-button').click();
  await page.getByTestId(`${action}-button`).click();

  const confirmDialog = page.getByTestId('app-action-confirm');

  await expect(confirmDialog).toBeVisible();

  const actionResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/apps') &&
      ['DELETE', 'PUT'].includes(response.request().method())
  );
  await page.getByTestId('app-action-confirm-confirm').click();
  await actionResponse;
};

test.describe.serial(
  'Applications in the settings modal',
  { tag: ['@Features', '@Platform'] },
  () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await ensureAppInstalled(apiContext);
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await ensureAppInstalled(apiContext);
      } finally {
        await afterAction();
      }
    });

    test.beforeEach(async ({ page }) => {
      await openApplications(page);
    });

    test('lists installed apps and opens an app with its header details', async ({
      page,
    }) => {
      await expect(page.getByTestId(APP_CARD)).toBeVisible();

      await openAppDetail(page);

      await expect(page.getByTestId('profile-content-header-title')).toHaveText(
        'Data Retention'
      );
      await expect(page.getByTestId('app-meta')).toContainText('Installed');
      await expect(page.getByTestId('app-meta')).toContainText('Developed by');
      await expect(page.getByRole('tab', { name: 'Schedule' })).toBeVisible();
      await expect(
        page.getByRole('tab', { name: 'Configuration' })
      ).toBeVisible();
      await expect(
        page.getByRole('tab', { name: 'Recent Runs' })
      ).toBeVisible();
    });

    test('edits the schedule', async ({ page }) => {
      await openAppDetail(page);

      await page.getByTestId('edit-button').click();

      const scheduleDialog = page.getByTestId('update-schedule-modal');

      await expect(scheduleDialog).toBeVisible();

      await selectScheduleType(page);
      await selectScheduleFrequency(page, 'week');
      await selectScheduleDayOfWeek(page, 'Wednesday');

      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/apps/') &&
          response.request().method() === 'PATCH'
      );
      await scheduleDialog.getByTestId('deploy-button').click();
      await patchResponse;

      await toastNotification(page, 'Schedule saved successfully');

      await expect(page.getByTestId('cron-string')).toContainText('Wednesday');
    });

    test('saves configuration from the footer with hints toggled on', async ({
      page,
    }) => {
      await openAppDetail(page);

      await page.getByRole('tab', { name: 'Configuration' }).click();

      const hintToggle = page.getByTestId('show-hint-toggle');

      await expect(hintToggle).toBeVisible();

      await hintToggle.click();

      await expect(hintToggle).toBeChecked();

      const field = page.locator('[id="root/changeEventRetentionPeriod"]');
      await field.fill('8');

      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/apps/') &&
          response.request().method() === 'PATCH'
      );
      const configureResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/v1/apps/configure/${APP_NAME}`) &&
          response.request().method() === 'POST'
      );
      await page
        .getByTestId('app-config-footer')
        .getByTestId('save-button')
        .click();
      await patchResponse;
      await configureResponse;

      await toastNotification(page, 'Configuration saved successfully');

      await expect(field).toHaveValue('8');
    });

    test('disables and restores the app from the three-dot menu', async ({
      page,
    }) => {
      await openAppDetail(page);
      await runManageAction(page, 'disable');

      await toastNotification(page, 'Application disabled successfully');

      await expect(page.getByTestId('applications-panel')).toBeVisible();

      const disabledAppsResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/apps?') &&
          response.url().includes('include=deleted')
      );
      await page.getByTestId('show-disabled').click();
      await disabledAppsResponse;

      const disabledCard = page.getByTestId(APP_CARD);

      await expect(disabledCard.getByTestId('disabled-badge')).toBeVisible();

      await openAppDetail(page);

      await expect(page.getByTestId('runtime-disabled-badge')).toBeVisible();

      await runManageAction(page, 'restore');

      await toastNotification(page, 'Application enabled successfully');
    });

    test('uninstalls the app and installs it again from the marketplace', async ({
      page,
    }) => {
      await openAppDetail(page);
      await runManageAction(page, 'uninstall');

      await toastNotification(page, 'Application uninstalled successfully');

      const marketplaceResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/apps/marketplace?') &&
          response.request().method() === 'GET'
      );
      await page.getByTestId('browse-apps').click();
      await marketplaceResponse;

      await page.getByTestId(APP_CARD).click();

      const installButton = page.getByTestId('install-application');

      await expect(installButton).toBeEnabled();
      await expect(page.getByTestId('app-resources')).toBeVisible();

      await installButton.click();

      await expect(page.getByTestId('authorize-card')).toBeVisible();

      await page.getByTestId('next-button').click();

      await expect(page.getByTestId('app-config-footer')).toBeVisible();

      await page
        .getByTestId('app-config-footer')
        .getByTestId('save-button')
        .click();

      await expect(page.getByTestId('cron-container')).toBeVisible();

      const installResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/apps') &&
          response.request().method() === 'POST'
      );
      await page
        .getByTestId('app-install-footer')
        .getByTestId('next-button')
        .click();
      const response = await installResponse;

      expect(response.status()).toBe(201);

      await toastNotification(page, 'Application installed successfully');

      await expect(page.getByTestId(APP_CARD)).toBeVisible();
    });
  }
);
