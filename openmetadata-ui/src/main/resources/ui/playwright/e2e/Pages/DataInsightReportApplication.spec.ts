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
import { expect, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.serial(
  'Data Insight Report Application',
  { tag: '@ingestion' },
  () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);

      const appsResponse = page.waitForResponse(
        `/api/v1/apps?limit=15&include=non-deleted`
      );

      await settingClick(page, GlobalSettingOptions.APPLICATIONS);
      await appsResponse;
    });

    test('Install application', async ({ page }) => {
      await page.click('[data-testid="add-application"]');
      // Verify response status code (this is done implicitly by the route fulfillment)
      await page.click(
        '[data-testid="data-insights-report-application-card"] [data-testid="config-btn"]'
      );
      await page.click('[data-testid="install-application"]');
      await page.click('[data-testid="save-button"]');
      await page.click('[data-testid="submit-btn"]');
      await page.click('[data-testid="cron-type"]');
      await page.click('[data-value="5"]');
      await page.click('[data-testid="deploy-button"]');

      // Verify response status code (this is done implicitly by the route fulfillment)
      await expect(
        page.locator('[data-testid="data-insights-report-application-card"]')
      ).toBeVisible();
    });

    test('Edit application', async ({ page }) => {
      await page.click(
        '[data-testid="data-insights-report-application-card"] [data-testid="config-btn"]'
      );

      await page.click('[data-testid="edit-button"]');
      await page.click('[data-testid="cron-type"]');
      await page.click('[data-value="3"]');
      await page.click('[data-testid="hour-options"]');
      await page.click('[title="01"]');
      await page.click('.ant-modal-body [data-testid="deploy-button"]');
      await toastNotification(page, 'Schedule saved successfully');

      // Validate update config in the application
      await expect(page.locator('[data-testid="cron-string"]')).toContainText(
        'At 01:00 AM, only on Wednesday'
      );

      await page.click('[data-testid="configuration"]');
      await page.click('#root\\/sendToAdmins');
      await page.click('#root\\/sendToTeams');
      await page.click('[data-testid="submit-btn"]');

      await toastNotification(page, 'Configuration saved successfully');

      // Validate update config in the application

      await expect(page.locator('#root\\/sendToAdmins')).not.toBeChecked();
      await expect(page.locator('#root\\/sendToTeams')).not.toBeChecked();
    });

    test('Run application', async ({ page }) => {
      await page.click(
        '[data-testid="data-insights-report-application-card"] [data-testid="config-btn"]'
      );

      await page.click('[data-testid="run-now-button"]');
      await toastNotification(page, 'Application triggered successfully');

      const { apiContext } = await getApiContext(page);

      expect
        .poll(
          async () => {
            const response = await apiContext
              .get(
                '/api/v1/apps/name/DataInsightsReportApplication/status?offset=0&limit=1'
              )
              .then((res) => res.json());

            return response.data[0].status;
          },
          {
            message:
              'Wait for the Data Insight Report Application run to be successful',
            timeout: 300_000,
            intervals: [2_000, 1_000],
          }
        )
        .toBe('success');

      await page.reload();

      await expect(page.getByTestId('logs')).toBeVisible();

      await page.click('[data-testid="logs"]');
    });

    test('Uninstall application', async ({ page }) => {
      await page.click(
        '[data-testid="data-insights-report-application-card"] [data-testid="config-btn"]'
      );

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="uninstall-button-title"]');
      await page.click('[data-testid="save-button"]');

      await toastNotification(page, 'Application uninstalled successfully');

      await expect(
        page.locator('[data-testid="data-insights-report-application-card"]')
      ).not.toBeVisible();
    });
  }
);
