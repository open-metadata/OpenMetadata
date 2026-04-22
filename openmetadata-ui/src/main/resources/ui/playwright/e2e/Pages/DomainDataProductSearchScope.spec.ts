/*
 *  Copyright 2026 Collate.
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

import base, { expect, Page } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

const domain = new Domain();
const dataProduct = new DataProduct([domain]);

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, setPage) => {
    const { page } = await performAdminLogin(browser);
    await setPage(page);
    await page.close();
  },
});

test.describe('Domain and Data Product search are scoped by entityType', () => {
  test.slow(true);

  test.beforeAll(
    'Seed one Domain and one DataProduct via API',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await domain.create(apiContext);
      await dataProduct.create(apiContext);
      await afterAction();
    }
  );

  test.afterAll('Delete seeded entities', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await dataProduct.delete(apiContext);
    await domain.delete(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Data Products do not appear in the Domains list view search', async ({
    page,
  }) => {
    await test.step('Navigate to Domains list', async () => {
      await sidebarClick(page, SidebarItem.DOMAIN);
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Search for the data product name — should not leak into domain results', async () => {
      const domainSearchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain')
      );
      await page
        .getByRole('main')
        .getByPlaceholder('Search')
        .fill(dataProduct.data.name);
      await domainSearchResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(
        page
          .getByRole('main')
          .getByText(dataProduct.data.displayName, { exact: true })
      ).toHaveCount(0);
    });

    await test.step('Positive control: searching the domain name shows the domain', async () => {
      const domainSearchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain')
      );
      await page.getByRole('main').getByPlaceholder('Search').clear();
      await page
        .getByRole('main')
        .getByPlaceholder('Search')
        .fill(domain.data.name);
      await domainSearchResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(
        page
          .getByRole('main')
          .getByText(domain.data.displayName, { exact: true })
          .first()
      ).toBeVisible();
    });
  });

  test('Domains do not appear in the Data Products list search', async ({
    page,
  }) => {
    await test.step('Navigate to Data Products', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Search for the domain name — should not leak into data product results', async () => {
      const dataProductSearchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=dataProduct')
      );
      await page
        .getByRole('main')
        .getByPlaceholder('Search')
        .fill(domain.data.name);
      await dataProductSearchResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(
        page
          .getByRole('main')
          .getByText(domain.data.displayName, { exact: true })
      ).toHaveCount(0);
    });

    await test.step('Positive control: searching the data product name shows the data product', async () => {
      const dataProductSearchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=dataProduct')
      );
      await page.getByRole('main').getByPlaceholder('Search').clear();
      await page
        .getByRole('main')
        .getByPlaceholder('Search')
        .fill(dataProduct.data.name);
      await dataProductSearchResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(
        page
          .getByRole('main')
          .getByText(dataProduct.data.displayName, { exact: true })
          .first()
      ).toBeVisible();
    });
  });

  test('Marketplace Domains widget lists only domain entities', async ({
    page,
  }) => {
    await test.step('Navigate to Data Marketplace', async () => {
      await page.goto('/data-marketplace');
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Data product id is not rendered as a marketplace domain card', async () => {
      await expect(
        page.getByTestId(`marketplace-domain-card-${dataProduct.responseData.id}`)
      ).toHaveCount(0);
    });
  });

  test('Marketplace search dropdown keeps domain and data product results in their own sections', async ({
    page,
  }) => {
    await test.step('Navigate to Data Marketplace', async () => {
      await page.goto('/data-marketplace');
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Searching data product name — result appears under data products, not under domains', async () => {
      const searchBar = page
        .getByTestId('marketplace-search-input')
        .locator('input');
      const dpResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=dataProduct')
      );
      const domainResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain')
      );
      await searchBar.fill(dataProduct.data.name);
      await Promise.all([dpResponse, domainResponse]);

      await expect(
        page.getByTestId(`search-result-dp-${dataProduct.responseData.id}`)
      ).toBeVisible();
      await expect(
        page.getByTestId(`search-result-domain-${dataProduct.responseData.id}`)
      ).toHaveCount(0);
    });

    await test.step('Searching domain name — result appears under domains, not under data products', async () => {
      const searchBar = page
        .getByTestId('marketplace-search-input')
        .locator('input');
      await searchBar.clear();
      const dpResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=dataProduct')
      );
      const domainResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=domain')
      );
      await searchBar.fill(domain.data.name);
      await Promise.all([dpResponse, domainResponse]);

      await expect(
        page.getByTestId(`search-result-domain-${domain.responseData.id}`)
      ).toBeVisible();
      await expect(
        page.getByTestId(`search-result-dp-${domain.responseData.id}`)
      ).toHaveCount(0);
    });
  });
});
