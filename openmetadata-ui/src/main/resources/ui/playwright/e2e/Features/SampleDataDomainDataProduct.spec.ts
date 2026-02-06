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

import { expect, test } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { redirectToHomePage } from '../../utils/common';
import { selectDomain } from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import { PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../constant/config';

test.use({ storageState: 'playwright/.auth/admin.json' });

const testDomainData: Domain['data'] = {
  name: 'TestDomain',
  displayName: 'TestDomain',
  description: 'A test domain for sample data',
  domainType: 'Aggregate',
};

test.describe('Sample Data Domain and Data Product Validation', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Verify TestDomain exists from sample data ingestion', async ({
    page,
  }) => {
    await sidebarClick(page, SidebarItem.DOMAIN);
    await waitForAllLoadersToDisappear(page);
    await selectDomain(page, testDomainData);
    await expect(page.getByTestId('entity-header-name')).toContainText(
      'TestDomain'
    );
  });

  test('Verify TestDataProduct exists under TestDomain', async ({ page }) => {
    await sidebarClick(page, SidebarItem.DOMAIN);
    await waitForAllLoadersToDisappear(page);
    await selectDomain(page, testDomainData);
    const dpRes = page.waitForResponse((response) =>
      response.url().includes('index=data_product_search_index')
    );
    await page.getByTestId('data_products').click();
    await dpRes;
    await waitForAllLoadersToDisappear(page);
    await expect(
      page.getByTestId('explore-card-TestDataProduct')
    ).toBeVisible();
  });

  test('Verify TestDataProduct shows correct details and domain association', async ({
    page,
  }) => {
    await sidebarClick(page, SidebarItem.DOMAIN);
    await waitForAllLoadersToDisappear(page);
    await selectDomain(page, testDomainData);
    const dpRes = page.waitForResponse((response) =>
      response.url().includes('index=data_product_search_index')
    );
    await page.getByTestId('data_products').click();
    await dpRes;
    await waitForAllLoadersToDisappear(page);
    const dataProductCard = page.getByTestId('explore-card-TestDataProduct');
    await expect(dataProductCard).toBeVisible();
    await dataProductCard.click();
    await page.waitForSelector(
      '[data-testid="entity-summary-panel-container"]',
      { state: 'visible' }
    );
    const summaryPanel = page.getByTestId('entity-summary-panel-container');
    await expect(summaryPanel).toContainText('Test Data Product');
    await expect(summaryPanel).toContainText(
      'A sample data product for testing purposes'
    );
  });
});
