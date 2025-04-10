/*
 *  Copyright 2023 Collate.
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

import test, { expect } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import {
  customFormatDateTime,
  getCurrentMillis,
  getEpochMillisForFutureDays,
} from '../../utils/dateTime';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.serial(
  'Data Insight settings page should work properly',
  { tag: '@data-insight' },
  () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);

      const appsResponse = page.waitForResponse(
        `/api/v1/apps?limit=15&include=non-deleted`
      );

      await settingClick(page, GlobalSettingOptions.APPLICATIONS);
      await appsResponse;
    });

    test('Edit data insight application', async ({ page }) => {
      const appResponse = page.waitForResponse(
        `/api/v1/apps/name/DataInsightsApplication?fields=owners%2Cpipelines&include=all`
      );

      // Click on the config button
      await page.click(
        '[data-testid="data-insights-application-card"] [data-testid="config-btn"]'
      );

      await appResponse;

      // Click on the edit button
      await page.getByTestId('edit-button').click();

      // Select cron type
      await page.getByTestId('cron-type').click();
      await page.click('.rc-virtual-list [title="Day"]');

      // Select hour
      await page.click('[data-testid="hour-options"]');
      await page.click('#hour-select_list + .rc-virtual-list [title="06"]');

      // Select minute
      await page.click('[data-testid="minute-options"]');
      await page.click('#minute-select_list + .rc-virtual-list [title="00"]');

      // Click on deploy button
      await page.click('.ant-modal-body [data-testid="deploy-button"]');

      await toastNotification(page, 'Schedule saved successfully');

      // Verify cron string
      await expect(page.locator('[data-testid="cron-string"]')).toContainText(
        'At 06:00 AM'
      );
    });

    test('Uninstall application', async ({ page }) => {
      const appResponse = page.waitForResponse(
        `/api/v1/apps/name/DataInsightsApplication?fields=*`
      );

      // Click on the config button
      await page.click(
        '[data-testid="data-insights-application-card"] [data-testid="config-btn"]'
      );

      await appResponse;

      // Click on the manage button
      await page.click('[data-testid="manage-button"]');

      // Click on the uninstall button
      await page.click('[data-testid="uninstall-button-title"]');

      // Click on the save button
      await page.click('[data-testid="save-button"]');

      await toastNotification(page, 'Application uninstalled successfully');

      await expect(
        page.locator('[data-testid="data-insights-application-card"]')
      ).toBeHidden();
    });

    test('Install application', async ({ page }) => {
      // Click on the add application button
      await page.click('[data-testid="add-application"]');

      // Click on the config button
      await page.click(
        '[data-testid="data-insights-application-card"] [data-testid="config-btn"]'
      );

      // Click on the install application button
      await page.click('[data-testid="install-application"]');

      // Click on the save button
      await page.click('[data-testid="save-button"]');

      // Enable backfill configuration
      await page.click('#root\\/backfillConfiguration\\/enabled');

      // Set start and end dates
      const startDate = customFormatDateTime(getCurrentMillis(), 'yyyy-MM-dd');
      const endDate = customFormatDateTime(
        getEpochMillisForFutureDays(5),
        'yyyy-MM-dd'
      );
      await page.fill('#root\\/backfillConfiguration\\/startDate', startDate);
      await page.fill('#root\\/backfillConfiguration\\/endDate', endDate);

      // Submit the form
      await page.click('[data-testid="submit-btn"]');

      // Set cron type
      await page.click('[data-testid="cron-type"]');
      await page.click('.rc-virtual-list [title="Day"]');

      await expect(
        page.locator('[data-testid="cron-type"] .ant-select-selection-item')
      ).toHaveText('Day');

      // Click on the deploy button
      await page.click('[data-testid="deploy-button"]');

      // Verify the application card is visible

      await expect(
        page.locator('[data-testid="data-insights-application-card"]')
      ).toBeVisible();
    });

    if (process.env.PLAYWRIGHT_IS_OSS) {
      // add this test once we have https://github.com/open-metadata/OpenMetadata/issues/19387
      test.fixme('Run application', async ({ page }) => {
        const appResponse = page.waitForResponse(
          `/api/v1/apps/name/DataInsightsApplication?fields=*`
        );

        // Click on the config button
        await page.click(
          '[data-testid="data-insights-application-card"] [data-testid="config-btn"]'
        );

        await appResponse;

        // Click on the run now button
        await page.click('[data-testid="run-now-button"]');

        const { apiContext } = await getApiContext(page);

        await page.waitForTimeout(2000);

        // Check data insight success status (assuming this is a custom function you need to implement)
        await expect
          .poll(
            async () => {
              const response = await apiContext
                .get(
                  '/api/v1/apps/name/DataInsightsApplication/status?offset=0&limit=1'
                )
                .then((res) => res.json());

              return response.data[0].status;
            },
            {
              // Custom expect message for reporting, optional.
              message: 'Wait for the pipeline to be successful',
              timeout: 60_000,
              intervals: [5_000, 10_000],
            }
          )
          .toBe('success');

        // update page
        await page.reload();

        // Click on the logs button
        await page.click('[data-testid="logs"]');

        // Verify the stats component contains 'Success'
        await expect(
          page.locator('[data-testid="stats-component"]')
        ).toContainText('Success');

        // Verify the app entity stats history table is visible
        await expect(
          page.locator('[data-testid="app-entity-stats-history-table"]')
        ).toBeVisible();
      });
    }
  }
);
