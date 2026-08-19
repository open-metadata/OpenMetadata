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
import test, { APIRequestContext, expect, Page } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { TagClass } from '../../support/tag/TagClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { clickUpdateButtonIfVisible } from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const CERTIFICATION_FILTER_LABEL = 'Certification';

const domain = new Domain();
const goldCertification = new TagClass({ classification: 'Certification' });
const silverCertification = new TagClass({ classification: 'Certification' });
const goldDataProduct = new DataProduct([domain]);
const silverDataProduct = new DataProduct([domain]);

const certificationPatch = (tagFQN: string): Operation[] => [
  {
    op: 'add',
    path: '/certification',
    value: {
      tagLabel: {
        tagFQN,
        source: 'Classification',
        labelType: 'Manual',
        state: 'Confirmed',
      },
    },
  },
];

const assignCertification = async (
  apiContext: APIRequestContext,
  dataProduct: DataProduct,
  certification: TagClass
) => {
  const response = await apiContext.patch(
    `/api/v1/dataProducts/${dataProduct.responseData.id}`,
    {
      data: certificationPatch(certification.responseData.fullyQualifiedName),
      headers: { 'Content-Type': 'application/json-patch+json' },
    }
  );
  expect(response.status()).toBe(200);
};


const lowercaseKey = (value: string) => value.toLowerCase();


const ensureFilterOptionVisible = async (
  page: Page,
  optionKey: string,
  searchText: string
) => {
  const menu = page.getByTestId('drop-down-menu');
  const option = menu.getByTestId(optionKey);

  await expect(async () => {
    const isMenuOpen = await menu.isVisible().catch(() => false);
    if (!isMenuOpen) {
      await page
        .getByTestId(`search-dropdown-${CERTIFICATION_FILTER_LABEL}`)
        .click();
      await menu.waitFor({ state: 'visible' });
    }
    await menu.getByTestId('search-input').fill(searchText);
    try {
      await option.waitFor({ state: 'visible', timeout: 5_000 });
    } catch (error) {
      await page.keyboard.press('Escape');
      throw error;
    }
  }).toPass({ timeout: 90_000, intervals: [2_000, 5_000, 10_000] });
};

const filterByCertification = async (
  page: Page,
  optionKey: string,
  searchText: string
) => {
  await ensureFilterOptionVisible(page, optionKey, searchText);
  const option = page.getByTestId('drop-down-menu').getByTestId(optionKey);

  const queryResponse = page.waitForResponse((response) => {
    if (!response.url().includes('/api/v1/search/query')) {
      return false;
    }
    const queryFilter =
      new URL(response.url()).searchParams.get('query_filter') ?? '';

    return queryFilter.includes(`"${optionKey}"`);
  });
  await option.click();
  await clickUpdateButtonIfVisible(page);
  await queryResponse;
  await waitForAllLoadersToDisappear(page);
};

const navigateToDataProducts = async (page: Page) => {
  await sidebarClick(page, SidebarItem.DATA_PRODUCT);
  await waitForAllLoadersToDisappear(page);
};

test.describe('Data Products - Certification filter', { tag: '@Governance' }, () => {
  test.describe.configure({ mode: 'serial' });
  test.slow();

  test.beforeAll('Setup certified data products', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await domain.create(apiContext);
    await goldCertification.create(apiContext);
    await silverCertification.create(apiContext);
    await goldDataProduct.create(apiContext);
    await silverDataProduct.create(apiContext);

    await assignCertification(apiContext, goldDataProduct, goldCertification);
    await assignCertification(
      apiContext,
      silverDataProduct,
      silverCertification
    );

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await goldDataProduct.delete(apiContext);
    await silverDataProduct.delete(apiContext);
    await goldCertification.delete(apiContext);
    await silverCertification.delete(apiContext);
    await domain.delete(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('lists only certifications assigned to data products', async ({
    page,
  }) => {
    await test.step('Navigate to the Data Products page', async () => {
      await navigateToDataProducts(page);
    });

    await test.step('Certification quick filter is available', async () => {
      await expect(
        page.getByTestId(`search-dropdown-${CERTIFICATION_FILTER_LABEL}`)
      ).toBeVisible();
    });

    await test.step('Assigned certifications are searchable', async () => {
      await ensureFilterOptionVisible(
        page,
        lowercaseKey(goldCertification.responseData.fullyQualifiedName),
        goldCertification.responseData.name
      );
      await ensureFilterOptionVisible(
        page,
        lowercaseKey(silverCertification.responseData.fullyQualifiedName),
        silverCertification.responseData.name
      );
      await page.keyboard.press('Escape');
    });
  });

  test('filtering by a certification narrows the listing', async ({ page }) => {
    await test.step('Navigate to the Data Products page', async () => {
      await navigateToDataProducts(page);
    });

    await test.step('Apply the gold certification filter', async () => {
      await filterByCertification(
        page,
        lowercaseKey(goldCertification.responseData.fullyQualifiedName),
        goldCertification.responseData.name
      );
    });

    await test.step('Only the gold-certified data product remains', async () => {
      await expect(
        page.getByText(goldDataProduct.responseData.displayName)
      ).toBeVisible();
      await expect(
        page.getByText(silverDataProduct.responseData.displayName)
      ).toBeHidden();
    });
  });
});
