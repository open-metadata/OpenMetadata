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

import test from '@playwright/test';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import MysqlIngestionClass from '../../support/entity/ingestion/MySqlIngestionClass';
import { addAndTriggerAutoClassificationPipeline } from '../../utils/autoClassification';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { settingClick, SettingOptionsType } from '../../utils/sidebar';

const mysqlService = new MysqlIngestionClass({
  tableFilter: ['sensitive_customers'],
});

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
  trace: process.env.PLAYWRIGHT_IS_OSS ? 'off' : 'on-first-retry',
  video: process.env.PLAYWRIGHT_IS_OSS ? 'on' : 'off',
});

test.describe.configure({
  // 11 minutes max for ingestion tests
  timeout: 11 * 60 * 1000,
});

test.describe('Auto Classification', PLAYWRIGHT_INGESTION_TAG_OBJ, async () => {
  test('should be able to auto classify data', async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(
      page,
      mysqlService.category as unknown as SettingOptionsType
    );

    // Create and ingest service data
    await mysqlService.createService(page);

    await addAndTriggerAutoClassificationPipeline(page, mysqlService);

    // Check if the classification is successful
    const getDatabases = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/databases?service=') &&
        response.request().method() === 'GET' &&
        response.status() === 200
    );

    // Click on databases tab
    await page.click('.ant-tabs-nav-list [data-testid="databases"]');

    await getDatabases;

    // Click on the database name
    await page.getByTestId('column-name').getByText('default').click();

    await page.waitForSelector('[data-testid="cypress_integrations_test_db"]');

    // Click on the database schema name
    await page.getByTestId('cypress_integrations_test_db').click();

    await page.waitForSelector('[data-testid="sensitive_customers"]');

    // Click on the table name
    await page.getByTestId('sensitive_customers').click();

    // Verify the sensitive tags
    await test
      .expect(
        page.locator(
          `[data-row-key*="user_name"] [data-testid="tag-PII.Sensitive"] `
        )
      )
      .toBeAttached();

    await test
      .expect(
        page.locator(
          `[data-row-key*="DWH_X10"] [data-testid="tag-PII.Sensitive"] `
        )
      )
      .toBeAttached();

    mysqlService.name;

    // Verify the non sensitive tags
    await test
      .expect(
        page.locator(
          `[data-row-key*="address"] [data-testid="tag-PII.Sensitive"] `
        )
      )
      .toBeAttached();

    // Delete the created service
    const { apiContext } = await getApiContext(page);
    await mysqlService.deleteServiceByAPI(apiContext);
  });
});
