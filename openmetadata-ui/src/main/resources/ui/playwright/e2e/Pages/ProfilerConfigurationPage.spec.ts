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
import { Page } from '@playwright/test';
import {
  PROFILER_EMPTY_RESPONSE_CONFIG,
  PROFILER_REQUEST_CONFIG,
} from '../../constant/profilerConfiguration';
import { SidebarItem } from '../../constant/sidebar';
import { expect, test as base } from '../../support/fixtures/base';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  clickOutside,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';

let user: UserClass;
const admin = new AdminClass();

// Create 2 page and authenticate 1 with admin and another with normal user
const test = base.extend<{ adminPage: Page; userPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await admin.signIn(page);
    await use(page);
    await page.close();
  },
  userPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user.signIn(page);
    await use(page);
    await page.close();
  },
});

// Create new user with admin login
base.beforeAll(async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  user = new UserClass();
  await user.create(apiContext);
  await afterAction();
});

const removeAllMetricConfigRows = async (page: Page) => {
  await page.getByTestId('add-fields').waitFor();
  while (await page.getByTestId('remove-filter-0').isVisible()) {
    await page.getByTestId('remove-filter-0').click();
  }
};

const selectDataType = async (page: Page, index: number, value: string) => {
  const input = page
    .getByTestId(`profiler-data-type-${index}`)
    .getByRole('combobox');
  await input.fill(value);
  await page.getByRole('option', { name: value, exact: true }).click();
};
const selectMetrics = async (page: Page, index: number, labels: string[]) => {
  await page
    .getByTestId(`profiler-metrics-${index}`)
    .getByRole('textbox')
    .click();
  if (labels.some((label) => label !== 'All')) {
    await page
      .getByRole('treegrid')
      .getByRole('button', { name: 'Expand All', exact: true })
      .click();
  }
  for (const label of labels) {
    await page.getByRole('treegrid').getByText(label, { exact: true }).click();
  }
  await clickOutside(page);
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
        .getByText(/^Data Type is required\.?$/)
        .waitFor({ state: 'visible' });

      await expect(
        adminPage.getByText(/^Data Type is required\.?$/)
      ).toHaveText(/Data Type is required/);

      await adminPage.click('[data-testid="cancel-button"]');
      await adminPage.waitForURL('**/settings/preferences', {
        waitUntil: 'domcontentloaded',
      });
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
      await selectDataType(adminPage, 0, 'AGG_STATE');
      await selectMetrics(adminPage, 0, ['All']);
      await adminPage.getByTestId('add-fields').click();
      await adminPage
        .getByTestId('profiler-data-type-1')
        .getByRole('combobox')
        .click();
      await expect(
        adminPage.getByRole('option', { name: 'AGG_STATE', exact: true })
      ).toHaveAttribute('aria-disabled', 'true');
      await selectDataType(adminPage, 1, 'AGGREGATEFUNCTION');
      await selectMetrics(adminPage, 1, ['Column Count', 'Column Names']);
      await adminPage.getByTestId('add-fields').click();
      await adminPage
        .getByTestId('profiler-data-type-2')
        .getByRole('combobox')
        .click();
      await expect(
        adminPage.getByRole('option', { name: 'AGG_STATE', exact: true })
      ).toHaveAttribute('aria-disabled', 'true');
      await expect(
        adminPage.getByRole('option', {
          name: 'AGGREGATEFUNCTION',
          exact: true,
        })
      ).toHaveAttribute('aria-disabled', 'true');
      await selectDataType(adminPage, 2, 'ARRAY');
      await selectMetrics(adminPage, 2, ['All']);
      await adminPage
        .getByTestId('profiler-disabled-2')
        .getByTestId('disabled-switch')
        .click();

      const settingRes = adminPage.waitForResponse('/api/v1/system/settings');
      await adminPage.click('[data-testid="save-button"]');
      await settingRes.then((res) => {
        expect(JSON.parse(res.request().postData() ?? '')).toStrictEqual(
          PROFILER_REQUEST_CONFIG
        );
      });

      await toastNotification(
        adminPage,
        /Profiler Configuration updated successfully/
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
        adminPage.getByTestId('store-sample-data-switch').getByRole('switch')
      ).toBeChecked();

      await expect(
        adminPage.getByTestId('read-sample-data-switch').getByRole('switch')
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
        adminPage.getByTestId('store-sample-data-switch').getByRole('switch')
      ).not.toBeChecked();

      await expect(
        adminPage.getByTestId('read-sample-data-switch').getByRole('switch')
      ).not.toBeChecked();

      // Turn store ON — read should auto-enable
      await adminPage.getByTestId('store-sample-data-switch').click();

      await expect(
        adminPage.getByTestId('store-sample-data-switch').getByRole('switch')
      ).toBeChecked();

      await expect(
        adminPage.getByTestId('read-sample-data-switch').getByRole('switch')
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
        adminPage.getByTestId('store-sample-data-switch').getByRole('switch')
      ).not.toBeChecked();

      await expect(
        adminPage.getByTestId('read-sample-data-switch').getByRole('switch')
      ).toBeChecked();

      // Re-enable store, then turn off read
      await adminPage.getByTestId('store-sample-data-switch').click();
      await adminPage.getByTestId('read-sample-data-switch').click();

      await expect(
        adminPage.getByTestId('store-sample-data-switch').getByRole('switch')
      ).toBeChecked();

      await expect(
        adminPage.getByTestId('read-sample-data-switch').getByRole('switch')
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
        /Profiler Configuration updated successfully/
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
