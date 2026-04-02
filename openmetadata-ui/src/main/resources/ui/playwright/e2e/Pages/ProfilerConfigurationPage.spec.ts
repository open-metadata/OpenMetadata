/*
 *  Copyright 2024 Collate.
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
import { expect, Page, test as base } from '@playwright/test';
import {
  PROFILER_EMPTY_RESPONSE_CONFIG,
  PROFILER_REQUEST_CONFIG,
} from '../../constant/profilerConfiguration';
import { SidebarItem } from '../../constant/sidebar';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  clickOutside,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';

const user = new UserClass();
const admin = new AdminClass();

// Create 2 page and authenticate 1 with admin and another with normal user
const test = base.extend<{ adminPage: Page; userPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await admin.login(page);
    await use(page);
    await page.close();
  },
  userPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user.login(page);
    await use(page);
    await page.close();
  },
});

// Create new user with admin login
base.beforeAll(async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await user.create(apiContext);
  await afterAction();
});

const removeAllMetricConfigRows = async (page: Page) => {
  await page.getByTestId('add-fields').waitFor();
  try {
    await page
      .locator('[data-testid^="remove-filter-"]')
      .first()
      .waitFor({ timeout: 1000 });
    const rows = page.locator('[data-testid^="remove-filter-"]');
    while ((await rows.count()) > 0) {
      await rows.first().click();
    }
  } catch {
    // No existing rows to clean up
  }
};

test.describe('Profiler Configuration Page', () => {
  /**
   * Admin user profiler configuration
   * @description Validates form validation, profiler config creation, updates, and removal for admin users.
   * Verifies metric selection, data type filtering, and API interactions.
   */
  test('Admin user', async ({ adminPage }) => {
    const profilerConfigurationRes = adminPage.waitForResponse(
      '/api/v1/system/settings/profilerConfiguration'
    );
    await sidebarClick(adminPage, SidebarItem.SETTINGS);
    await adminPage.click('[data-testid="preferences"]');
    await adminPage.click('[data-testid="preferences.profiler-configuration"]');
    await profilerConfigurationRes;

    /**
     * Step: Validation
     * @description Verifies form validation for required Data Type field.
     */
    await test.step('Verify validation', async () => {
      await removeAllMetricConfigRows(adminPage);

      await adminPage.click('[data-testid="add-fields"]');
      await adminPage.click('[data-testid="save-button"]');
      await adminPage
        .locator('#metricConfiguration_0_dataType_help')
        .waitFor({ state: 'visible' });

      await expect(
        adminPage.locator('#metricConfiguration_0_dataType_help')
      ).toHaveText('Data Type is required.');

      await adminPage.click('[data-testid="cancel-button"]');
      await adminPage.waitForURL('**/settings/preferences');
    });

    /**
     * Step: Add configurations
     * @description Adds multiple metric configurations with different data types and metrics.
     * Validates disabled state for previously selected data types.
     */
    await test.step('Update profiler configuration', async () => {
      await adminPage.click(
        '[data-testid="preferences.profiler-configuration"]'
      );
      await profilerConfigurationRes;

      await removeAllMetricConfigRows(adminPage);

      await adminPage.click('[data-testid="add-fields"]');
      await adminPage.click('#metricConfiguration_0_dataType');
      await adminPage.fill('#metricConfiguration_0_dataType', 'AGG_STATE');
      await adminPage.click(`[title="AGG_STATE"]`);
      await adminPage.click('#metricConfiguration_0_metrics');
      await adminPage.fill('#metricConfiguration_0_metrics', 'All');
      await adminPage.getByRole('tree').getByText('All').click();
      await clickOutside(adminPage);

      await adminPage.click('[data-testid="add-fields"]');
      await adminPage.click('#metricConfiguration_1_dataType');

      await expect(
        adminPage.locator(`[title="AGG_STATE"]:has(:visible)`)
      ).toHaveClass(/ant-select-item-option-disabled/);

      await adminPage.fill(
        '#metricConfiguration_1_dataType',
        'AGGREGATEFUNCTION'
      );
      await adminPage.click(`[title="AGGREGATEFUNCTION"]:has(:visible)`);

      await adminPage.click('#metricConfiguration_1_metrics');
      await adminPage.fill('#metricConfiguration_1_metrics', 'column');
      await adminPage.click(`[title="Column Count"]:has(:visible)`);
      await adminPage.click(`[title="Column Names"]:has(:visible)`);
      await clickOutside(adminPage);

      await adminPage.click('[data-testid="add-fields"]');
      await adminPage.click('#metricConfiguration_2_dataType');

      await expect(
        adminPage.locator(`[title="AGG_STATE"]:has(:visible)`)
      ).toHaveClass(/ant-select-item-option-disabled/);
      await expect(
        adminPage.locator(`[title="AGGREGATEFUNCTION"]:has(:visible)`)
      ).toHaveClass(/ant-select-item-option-disabled/);

      await adminPage.click(`[title="ARRAY"]:has(:visible)`);
      await adminPage.click('#metricConfiguration_2_metrics');
      await adminPage.fill('#metricConfiguration_2_metrics', 'All');
      await adminPage.getByRole('tree').getByText('All').click();
      await clickOutside(adminPage);

      await adminPage.click('#metricConfiguration_2_disabled');

      const settingRes = adminPage.waitForResponse('/api/v1/system/settings');
      await adminPage.click('[data-testid="save-button"]');
      await settingRes.then((res) => {
        expect(JSON.parse(res.request().postData() ?? '')).toStrictEqual(
          PROFILER_REQUEST_CONFIG
        );
      });

      await toastNotification(
        adminPage,
        /Profiler Configuration updated successfully./
      );
    });

    /**
     * Step: Remove configurations
     * @description Deletes all metric configurations and verifies empty state.
     */
    await test.step('Remove Configuration', async () => {
      await adminPage.click('[data-testid="remove-filter-2"]');
      await adminPage.click('[data-testid="remove-filter-1"]');
      await adminPage.click('[data-testid="remove-filter-0"]');

      const updateProfilerConfigurationRes = adminPage.waitForResponse(
        '/api/v1/system/settings'
      );
      await adminPage.click('[data-testid="save-button"]');
      await updateProfilerConfigurationRes.then((res) => {
        expect(JSON.parse(res.request().postData() ?? '')).toStrictEqual(
          PROFILER_EMPTY_RESPONSE_CONFIG
        );
      });
    });
  });

  /**
   * Sample Data Ingestion Configuration
   * @description Validates the sample data config section: toggle rendering, default state,
   * and the "store enables read" auto-toggle behavior.
   */
  test('Sample Data Ingestion Configuration', async ({ adminPage }) => {
    const profilerConfigurationRes = adminPage.waitForResponse(
      '/api/v1/system/settings/profilerConfiguration'
    );
    await sidebarClick(adminPage, SidebarItem.SETTINGS);
    await adminPage.click('[data-testid="preferences"]');
    await adminPage.click('[data-testid="preferences.profiler-configuration"]');
    await profilerConfigurationRes;

    /**
     * Step: Verify sample data config section renders
     * @description Checks both toggles are visible and default to ON.
     */
    await test.step('Verify sample data config section renders', async () => {
      await expect(
        adminPage.getByTestId('sample-data-ingestion-config')
      ).toBeVisible();

      await expect(
        adminPage.getByTestId('store-sample-data-switch')
      ).toBeVisible();

      await expect(
        adminPage.getByTestId('read-sample-data-switch')
      ).toBeVisible();

      await expect(
        adminPage.getByTestId('store-sample-data-switch')
      ).toBeChecked();

      await expect(
        adminPage.getByTestId('read-sample-data-switch')
      ).toBeChecked();
    });

    /**
     * Step: Toggling store ON enables read
     * @description When read is OFF and store is toggled ON, read should auto-enable.
     */
    await test.step('Toggling store ON auto-enables read', async () => {
      // Turn off both toggles
      await adminPage.getByTestId('store-sample-data-switch').click();
      await adminPage.getByTestId('read-sample-data-switch').click();

      await expect(
        adminPage.getByTestId('store-sample-data-switch')
      ).not.toBeChecked();

      await expect(
        adminPage.getByTestId('read-sample-data-switch')
      ).not.toBeChecked();

      // Turn store ON — read should auto-enable
      await adminPage.getByTestId('store-sample-data-switch').click();

      await expect(
        adminPage.getByTestId('store-sample-data-switch')
      ).toBeChecked();

      await expect(
        adminPage.getByTestId('read-sample-data-switch')
      ).toBeChecked();
    });

    /**
     * Step: Toggling off does not affect the other
     * @description Turning off store should not turn off read, and vice versa.
     */
    await test.step('Toggling off one does not affect the other', async () => {
      // Both are ON from previous step — turn off store
      await adminPage.getByTestId('store-sample-data-switch').click();

      await expect(
        adminPage.getByTestId('store-sample-data-switch')
      ).not.toBeChecked();

      await expect(
        adminPage.getByTestId('read-sample-data-switch')
      ).toBeChecked();

      // Re-enable store, then turn off read
      await adminPage.getByTestId('store-sample-data-switch').click();
      await adminPage.getByTestId('read-sample-data-switch').click();

      await expect(
        adminPage.getByTestId('store-sample-data-switch')
      ).toBeChecked();

      await expect(
        adminPage.getByTestId('read-sample-data-switch')
      ).not.toBeChecked();
    });

    /**
     * Step: Sample data config is persisted on save
     * @description Saves with modified toggles and verifies the payload.
     */
    await test.step('Sample data config is included in save payload', async () => {
      // Reset to both ON
      await adminPage.getByTestId('read-sample-data-switch').click();

      const settingRes = adminPage.waitForResponse('/api/v1/system/settings');
      await adminPage.click('[data-testid="save-button"]');
      await settingRes.then((res) => {
        const payload = JSON.parse(res.request().postData() ?? '');

        expect(payload.config_value.sampleDataConfig).toStrictEqual({
          storeSampleData: true,
          readSampleData: true,
        });
      });

      await toastNotification(
        adminPage,
        /Profiler Configuration updated successfully./
      );
    });
  });

  /**
   * Non-admin user access restriction
   * @description Verifies that non-admin users cannot access profiler configuration preferences.
   */
  test('Non admin user', async ({ userPage }) => {
    await redirectToHomePage(userPage);
    await sidebarClick(userPage, SidebarItem.SETTINGS);

    await expect(
      userPage.locator('[data-testid="preferences"]')
    ).not.toBeVisible();
  });
});
