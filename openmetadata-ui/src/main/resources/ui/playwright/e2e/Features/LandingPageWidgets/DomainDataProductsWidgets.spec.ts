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
import { Page, test as base } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { DataProduct } from '../../../support/domain/DataProduct';
import { Domain } from '../../../support/domain/Domain';
import { SubDomain } from '../../../support/domain/SubDomain';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import {
  addAndVerifyWidget,
  setUserDefaultPersona,
  verifyDataProductCountInDataProductWidget,
  verifyDomainCountInDomainWidget,
} from '../../../utils/customizeLandingPage';
import {
  addAssetsToDataProduct,
  addAssetsToDomain,
  checkAssetsCount,
  selectDataProduct,
  selectDomain,
} from '../../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { sidebarClick } from '../../../utils/sidebar';

const adminUser = new UserClass();

const persona = new PersonaClass();
const domain = new Domain();
const subDomain = new SubDomain(domain);
const dataProduct = new DataProduct([domain]);
const table = new TableClass();
const topic = new TopicClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    await use(page);
    await page.close();
  },
});

base.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await persona.create(apiContext, [adminUser.responseData.id]);
  await domain.create(apiContext);
  await subDomain.create(apiContext);
  await dataProduct.create(apiContext);
  await table.create(apiContext);
  await topic.create(apiContext);
  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await table.delete(apiContext);
  await topic.delete(apiContext);
  await dataProduct.delete(apiContext);
  await domain.delete(apiContext);
  await persona.delete(apiContext);
  await adminUser.delete(apiContext);

  await afterAction();
});

test.describe.serial('Domain and Data Product Asset Counts', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
  });

  test('Assign Widgets', async ({ page }) => {
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await addAndVerifyWidget(
      page,
      'KnowledgePanel.Domains',
      persona.responseData.name
    );
    await addAndVerifyWidget(
      page,
      'KnowledgePanel.DataProducts',
      persona.responseData.name
    );
  });

  test('Verify Widgets are having 0 count initially', async ({ page }) => {
    await verifyDomainCountInDomainWidget(
      page,
      domain.responseData.id ?? '',
      0
    );
    await verifyDataProductCountInDataProductWidget(
      page,
      dataProduct.responseData.id ?? '',
      0
    );
  });

  test('Domain asset count should update when assets are added', async ({
    page,
  }) => {
    // Navigate to domain page and add assets via UI
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await sidebarClick(page, SidebarItem.DOMAIN);

    // addAssetsToDomain navigates to assets tab, adds assets, and verifies count
    await addAssetsToDomain(page, domain, [table, topic]);

    // After addAssetsToDomain, count should be 2
    await checkAssetsCount(page, 2);

    await redirectToHomePage(page);
    await verifyDomainCountInDomainWidget(
      page,
      domain.responseData.id ?? '',
      2
    );
  });

  test('Data Product asset count should update when assets are added', async ({
    page,
  }) => {
    // Navigate to data product page
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, dataProduct.data);

    // Add assets to data product using UI
    // addAssetsToDataProduct clicks assets tab and verifies 0 count first
    await addAssetsToDataProduct(
      page,
      dataProduct.responseData.fullyQualifiedName ?? '',
      [table, topic]
    );

    await redirectToHomePage(page);
    await verifyDataProductCountInDataProductWidget(
      page,
      dataProduct.responseData.id ?? '',
      2
    );
  });

  test('Domain asset count should update when assets are removed', async ({
    page,
  }) => {
    // Current state: domain has 2 assets (table, topic)
    // Navigate to domain page
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, domain.data);

    // Click assets tab and verify count is 2
    await page.getByTestId('assets').click();
    await checkAssetsCount(page, 2);

    // Select topic and remove it
    const topicFqn = topic.entityResponseData.fullyQualifiedName;
    await page
      .locator(`[data-testid="table-data-card_${topicFqn}"] input`)
      .check();

    const removeRes = page.waitForResponse('**/assets/remove');
    await page.getByTestId('delete-all-button').click();
    await removeRes;

    // Check assets count is now 1
    await page.reload();
    await page.waitForLoadState('networkidle');
    await checkAssetsCount(page, 1);

    await redirectToHomePage(page);
    await verifyDomainCountInDomainWidget(
      page,
      domain.responseData.id ?? '',
      1
    );
  });

  test('Data Product asset count should update when assets are removed', async ({
    page,
  }) => {
    // Navigate to data product page
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, dataProduct.data);

    // Click assets tab - data product should have some assets from previous test
    await page.getByTestId('assets').click();
    await page.waitForLoadState('networkidle');

    // Wait for assets to load
    await page
      .waitForSelector('[data-testid="loader"]', {
        state: 'detached',
        timeout: 10000,
      })
      .catch(() => {
        /* ignore if loader not found */
      });

    // Keep removing assets until no more are left
    let hasAssets = true;
    while (hasAssets) {
      const checkboxes = page.locator(
        '[data-testid^="table-data-card_"] input[type="checkbox"]'
      );
      const count = await checkboxes.count();

      if (count === 0) {
        hasAssets = false;

        break;
      }

      // Try to use Select All if available, otherwise select individually
      const selectAll = page.getByRole('checkbox', { name: 'Select All' });
      if (await selectAll.isVisible()) {
        await selectAll.check();
      } else {
        // Select all visible assets individually
        for (let i = 0; i < count; i++) {
          await checkboxes.nth(i).check();
        }
      }

      const removeRes = page.waitForResponse('**/assets/remove');
      await page.getByTestId('delete-all-button').click();
      await removeRes;

      // Wait for search to refresh
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }

    // Refresh and check the assets tab shows 0
    await page.reload();
    await page.waitForLoadState('networkidle');
    await checkAssetsCount(page, 0);

    await redirectToHomePage(page);
    await verifyDataProductCountInDataProductWidget(
      page,
      dataProduct.responseData.id ?? '',
      0
    );
  });
});
