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
import { visitEntityPageWithCustomSearchBox } from '../../utils/entity';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Frequently Joined', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await visitEntityPageWithCustomSearchBox({
      page,
      searchTerm: 'sample_data.ecommerce_db.shopify.fact_sale',
      dataTestId: 'sample_data-fact_sale',
    });
  });

  test('should display frequently joined columns', async ({ page }) => {
    const rowSelector =
      '[data-row-key="sample_data.ecommerce_db.shopify.fact_sale.customer_id"]';

    await expect(page.locator(rowSelector)).toContainText(
      'Frequently Joined Columns:ecommerce_db.shopify.dim_customer.customer_id'
    );

    await page
      .locator(rowSelector)
      .getByText('ecommerce_db.shopify.dim_customer.customer_id')
      .click();

    await expect(page).toHaveURL(
      /ecommerce_db\.shopify\.dim_customer\.customer_id/
    );
  });

  test('should display frequently joined table', async ({ page }) => {
    // verify the joined tables
    await expect(
      page.getByRole('link', { name: 'ecommerce_db.dim_customer', exact: true })
    ).toHaveText('ecommerce_db.dim_customer');

    await expect(
      page.getByRole('link', { name: 'ecommerce_db.fact_order', exact: true })
    ).toHaveText('ecommerce_db.fact_order');

    // navigate to joined table
    await page
      .getByRole('link', {
        name: 'ecommerce_db.fact_order',
        exact: true,
      })
      .click();

    // verify the url
    await expect(page).toHaveURL(/ecommerce_db\.shopify\.fact_order/);

    // verify the reverse relationship of joined table
    await expect(
      page.getByRole('link', { name: 'ecommerce_db.fact_sale', exact: true })
    ).toHaveText('ecommerce_db.fact_sale');
  });
});
