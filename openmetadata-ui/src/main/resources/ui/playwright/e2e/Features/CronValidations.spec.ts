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

import { expect, Page, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

const inputCronExpression = async (page: Page, cron: string) => {
  await page
    .locator('[data-testid="cron-container"] #schedular-form_cron')
    .click();
  await page
    .locator('[data-testid="cron-container"] #schedular-form_cron')
    .clear();
  await page
    .locator('[data-testid="cron-container"] #schedular-form_cron')
    .fill(cron);
};

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Cron Validations', () => {
  const cronInvlidMessage =
    'Cron expression must have exactly 5 fields (minute hour day-of-month month day-of-week)';

  const cronInvalidMinuteMessage =
    'Invalid minute field. Must be 0-59, *, */n, or comma-separated values';

  const cronInvalidDayOfWeekMessage =
    'Invalid day-of-week field. Must be 0-6, *, */n, or comma-separated values';

  test('Validate different cron expressions', async ({ page }) => {
    await redirectToHomePage(page);

    await settingClick(page, GlobalSettingOptions.APPLICATIONS);

    const applicationResponse = page.waitForResponse(
      '/api/v1/apps/name/SearchIndexingApplication/status?offset=0&limit=1'
    );

    await page
      .locator(
        '[data-testid="search-indexing-application-card"] [data-testid="config-btn"]'
      )
      .click();

    await applicationResponse;

    await page.click('[data-testid="edit-button"]');
    await page.waitForSelector('[data-testid="schedular-card-container"]');
    await page
      .getByTestId('schedular-card-container')
      .getByText('Schedule', { exact: true })
      .click();

    await page
      .getByTestId('time-dropdown-container')
      .getByTestId('cron-type')
      .click();

    await page.click('.ant-select-dropdown:visible [title="Custom"]');

    await page.waitForSelector(
      '[data-testid="cron-container"] #schedular-form_cron'
    );

    // Check Valid Crons

    // Check '0 0 * * *' to be valid
    await inputCronExpression(page, '0 0 * * *');

    await expect(
      page.getByTestId('cron-container').getByText('At 12:00 AM, every day')
    ).toBeAttached();
    await expect(page.locator('#schedular-form_cron_help')).not.toBeAttached();

    // Check '0 0 1/3 * * 1' to be valid
    await inputCronExpression(page, '0 0 1/3 * * 1');

    await expect(
      page.getByTestId('cron-container').getByText(cronInvlidMessage)
    ).toBeAttached();

    // Check '0 0 * * 1-6' to be valid
    await inputCronExpression(page, '0 0 * * 1-6');

    await expect(
      page
        .getByTestId('cron-container')
        .getByText('At 12:00 AM, Monday through Saturday')
    ).toBeAttached();
    await expect(page.locator('#schedular-form_cron_help')).not.toBeAttached();

    // Check Invalid crons

    // Check every minute frequency throws an error
    await inputCronExpression(page, '0/1 0 * * *');

    await expect(
      page
        .locator('#schedular-form_cron_help')
        .getByText(cronInvalidMinuteMessage)
    ).toBeAttached();

    // Check every second frequency throws an error
    await inputCronExpression(page, '0/1 0 * * * 1');

    await expect(
      page
        .locator('#schedular-form_cron_help')
        .getByText(cronInvalidMinuteMessage)
    ).toBeAttached();

    // Check '0 0 * * 7' to be invalid
    await inputCronExpression(page, '0 0 * * 7');

    await expect(
      page
        .locator('#schedular-form_cron_help')
        .getByText(cronInvalidDayOfWeekMessage)
    ).toBeAttached();

    // Check '0 0 * * 1 7' to be invalid
    await inputCronExpression(page, '0 0 * * 1 7');

    await expect(
      page.locator('#schedular-form_cron_help').getByText(cronInvlidMessage)
    ).toBeAttached();

    // Check '0 0 * * 1 7 67' to be invalid
    await inputCronExpression(page, '0 0 * * 1 7 67');

    await expect(
      page.locator('#schedular-form_cron_help').getByText(cronInvlidMessage)
    ).toBeAttached();

    // Check '0 0 * * 0-7' to be invalid
    await inputCronExpression(page, '0 0 * * 0-7');

    await expect(
      page
        .locator('#schedular-form_cron_help')
        .getByText(cronInvalidDayOfWeekMessage)
    ).toBeAttached();

    // Check '0 0 * * 7-9' to be invalid
    await inputCronExpression(page, '0 0 * * 7-9');

    await expect(
      page
        .locator('#schedular-form_cron_help')
        .getByText(cronInvalidDayOfWeekMessage)
    ).toBeAttached();

    // Check '0 0 * * -1-9' to be invalid
    await inputCronExpression(page, '0 0 * * -1-9');

    await expect(
      page
        .locator('#schedular-form_cron_help')
        .getByText(cronInvalidDayOfWeekMessage)
    ).toBeAttached();
  });
});
