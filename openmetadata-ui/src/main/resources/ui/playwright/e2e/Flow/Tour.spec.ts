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
import { redirectToHomePage } from '../../utils/common';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Tour should work properly', () => {
  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('All tour steps should work', async ({ page }) => {
    await page.locator('[data-testid="help-icon"]').click();
    await page.getByRole('link', { name: 'Tour' }).click();
    // step 1
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();

    // step 2
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();
    await page.getByTestId('searchBox').fill('dim_a');
    await page.getByTestId('searchBox').press('Enter');

    // step 3
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();

    await expect(
      page.getByTestId('sample_data.ecommerce_db.shopify.dim_address')
    ).toBeVisible();

    // step 4
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();
    // step 5
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();
    // step 6
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();
    // step 7
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();
    // step 8
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();

    await expect(
      page.getByTestId('sample_data').getByText('Sample Data')
    ).toBeVisible();

    // step 9
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();
    // step 10
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();

    await expect(page.getByText('Profiler & Data Quality')).toBeVisible();

    // step 11
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();

    // step 12
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();

    await expect(
      page.getByTestId('lineage').getByText('Lineage')
    ).toBeVisible();

    // step 13
    await page.locator('.sc-gLLuof > button:nth-child(3)').click();
    await page.getByTestId('last-step-button').click();
    await page.getByTestId('saveButton').click();
  });
});
