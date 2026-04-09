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
import { expect } from '@playwright/test';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import {
  closeSearchPopover,
  navigateToMarketplace,
  searchMarketplace,
} from '../../utils/dataMarketplace';
import { fillCommonFormItems, fillDomainForm } from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

const domain1 = new Domain();
const domain2 = new Domain();
const domain3 = new Domain();
const domain4 = new Domain();

const dp1 = new DataProduct([domain1]);
const dp2 = new DataProduct([domain1]);
const dp3 = new DataProduct([domain1]);
const dp4 = new DataProduct([domain1]);

const uiCreatedDpName = `PW-mp-dp-${uuid()}`;
const uiCreatedDomainName = `PW-mp-domain-${uuid()}`;

test.describe(
  'Data Marketplace - Core',
  { tag: ['@Pages', '@Discovery'] },
  () => {
    test.beforeAll('Setup entities', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await domain1.create(apiContext);
      await domain2.create(apiContext);
      await domain3.create(apiContext);
      await domain4.create(apiContext);

      await dp1.create(apiContext);
      await dp2.create(apiContext);
      await dp3.create(apiContext);
      await dp4.create(apiContext);

      await afterAction();
    });

    test.afterAll('Cleanup entities', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      // Clean up UI-created entities (may not exist if creation tests didn't run)
      await apiContext
        .delete(
          `/api/v1/dataProducts/name/${encodeURIComponent(
            uiCreatedDpName
          )}?hardDelete=true`
        )
        .catch(() => {});
      await apiContext
        .delete(
          `/api/v1/domains/name/${encodeURIComponent(
            uiCreatedDomainName
          )}?hardDelete=true`
        )
        .catch(() => {});

      await dp4.delete(apiContext);
      await dp3.delete(apiContext);
      await dp2.delete(apiContext);
      await dp1.delete(apiContext);

      await domain4.delete(apiContext);
      await domain3.delete(apiContext);
      await domain2.delete(apiContext);
      await domain1.delete(apiContext);

      await afterAction();
    });

    test('Page renders with greeting, search, and default widgets', async ({
      page,
    }) => {
      test.slow();

      await test.step('Navigate to marketplace via sidebar', async () => {
        await navigateToMarketplace(page);
        await expect(page).toHaveURL(/.*data-marketplace/);
      });

      await test.step('Verify greeting banner', async () => {
        await expect(page.getByTestId('marketplace-greeting')).toBeVisible();
        await expect(page.getByTestId('greeting-text')).toBeVisible();
      });

      await test.step('Verify search bar is present', async () => {
        const searchInput = page.getByTestId('marketplace-search-input');
        await expect(searchInput).toBeVisible();
        await expect(searchInput).toBeEnabled();
      });

      await test.step('Verify data products widget', async () => {
        await expect(page.getByTestId('marketplace-dp-widget')).toBeVisible();
        await expect(page.getByTestId('view-all-data-products')).toBeVisible();
      });

      await test.step('Verify domains widget', async () => {
        await expect(
          page.getByTestId('marketplace-domains-widget')
        ).toBeVisible();
        await expect(page.getByTestId('view-all-domains')).toBeVisible();
      });

      await test.step('Verify admin action buttons', async () => {
        await expect(page.getByTestId('add-data-product-btn')).toBeVisible();
        await expect(page.getByTestId('add-domain-btn')).toBeVisible();
      });
    });

    test('Search returns results and clicking navigates to entity', async ({
      page,
    }) => {
      test.slow();

      await test.step('Navigate to marketplace', async () => {
        await navigateToMarketplace(page);
      });

      await test.step('Search for a data product', async () => {
        await searchMarketplace(page, dp4.data.displayName);
        const resultItem = page.getByTestId(
          `search-result-dp-${dp4.responseData.id}`
        );
        await expect(resultItem).toBeVisible();
      });

      await test.step('Click data product result and verify navigation', async () => {
        const resultItem = page.getByTestId(
          `search-result-dp-${dp4.responseData.id}`
        );
        await resultItem.dispatchEvent('click');
        await page.waitForURL('**/data-marketplace/data-products/**');
      });

      await test.step('Navigate back and search for a domain', async () => {
        await navigateToMarketplace(page);
        await searchMarketplace(page, domain4.data.displayName);
        await expect(
          page.getByTestId(`search-result-domain-${domain4.responseData.id}`)
        ).toBeVisible();
      });

      await test.step('Click domain result and verify navigation', async () => {
        const resultItem = page.getByTestId(
          `search-result-domain-${domain4.responseData.id}`
        );
        await resultItem.dispatchEvent('click');
        await page.waitForURL('**/data-marketplace/domains/**');
      });
    });

    test('Widget card click navigates to entity detail page', async ({
      page,
    }) => {
      test.slow();

      await test.step('Navigate to marketplace', async () => {
        await navigateToMarketplace(page);
      });

      await test.step('Click data product card and verify navigation', async () => {
        const dpWidget = page.getByTestId('marketplace-dp-widget');
        const dpCard = dpWidget
          .locator('[data-testid^="marketplace-dp-card-"]')
          .first();
        await expect(dpCard).toBeVisible();
        await dpCard.click();
        await page.waitForURL('**/data-marketplace/data-products/**');
      });

      await test.step('Navigate back and click domain card', async () => {
        await navigateToMarketplace(page);
        const domainsWidget = page.getByTestId('marketplace-domains-widget');
        const domainCard = domainsWidget
          .locator('[data-testid^="marketplace-domain-card-"]')
          .first();
        await expect(domainCard).toBeVisible();
        await domainCard.click();
        await page.waitForURL('**/data-marketplace/domains/**');
      });
    });

    test('View All links navigate correctly', async ({ page }) => {
      test.slow();

      await test.step('Navigate to marketplace', async () => {
        await navigateToMarketplace(page);
      });

      await test.step('Click View All Data Products and verify', async () => {
        const viewAllDp = page.getByTestId('view-all-data-products');
        await expect(viewAllDp).toBeVisible();
        await viewAllDp.click();
        await page.waitForURL('**/data-marketplace/data-products**');
      });

      await test.step('Navigate back and click View All Domains', async () => {
        await navigateToMarketplace(page);
        const viewAllDomains = page.getByTestId('view-all-domains');
        await expect(viewAllDomains).toBeVisible();
        await viewAllDomains.click();
        await page.waitForURL('**/data-marketplace/domains**');
      });
    });

    test('Admin can create a data product via marketplace drawer', async ({
      page,
    }) => {
      test.slow();

      await test.step('Navigate to marketplace', async () => {
        await navigateToMarketplace(page);
      });

      await test.step('Open add data product drawer', async () => {
        await page.getByTestId('add-data-product-btn').click();
        await expect(page.getByTestId('add-domain')).toBeVisible();
      });

      await test.step('Fill data product form and select domain', async () => {
        await fillCommonFormItems(page, {
          name: uiCreatedDpName,
          displayName: uiCreatedDpName,
          description: 'Playwright marketplace data product',
          domains: [],
        } as DataProduct['data']);

        const domainInput = page.getByTestId('domain-select');
        await domainInput.scrollIntoViewIfNeeded();
        await domainInput.click();

        const searchDomain = page.waitForResponse((response) =>
          response.url().includes('/api/v1/search/query?q=')
        );
        await domainInput.fill(domain1.responseData.displayName);
        await searchDomain;

        const domainOption = page.getByText(domain1.responseData.displayName);
        await expect(domainOption).toBeVisible();
        await domainOption.click();
      });

      await test.step('Submit form and verify creation', async () => {
        const createResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataProducts') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('save-btn').click();
        const response = await createResponse;
        expect(response.status()).toBe(201);
      });

      await test.step('Verify drawer closes and widget refreshes', async () => {
        await expect(page.getByTestId('add-domain')).not.toBeVisible();
        await waitForAllLoadersToDisappear(page);
        await expect(page.getByTestId('marketplace-dp-widget')).toBeVisible();
      });
    });

    test('Admin can create a domain via marketplace drawer', async ({
      page,
    }) => {
      test.slow();

      await test.step('Navigate to marketplace', async () => {
        await navigateToMarketplace(page);
      });

      await test.step('Open add domain drawer', async () => {
        await page.getByTestId('add-domain-btn').click();
        await expect(page.getByTestId('add-domain')).toBeVisible();
      });

      await test.step('Fill domain form and select type', async () => {
        await fillDomainForm(page, {
          name: uiCreatedDomainName,
          displayName: uiCreatedDomainName,
          description: 'Playwright marketplace domain',
          domainType: 'Aggregate',
        });
      });

      await test.step('Submit form and verify creation', async () => {
        const createResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/domains') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('save-btn').click();
        const response = await createResponse;
        expect(response.status()).toBe(201);
      });

      await test.step('Verify drawer closes and widget refreshes', async () => {
        await expect(page.getByTestId('add-domain')).not.toBeVisible();
        await waitForAllLoadersToDisappear(page);
        await expect(
          page.getByTestId('marketplace-domains-widget')
        ).toBeVisible();
      });
    });

    test('Search with no results shows empty state', async ({ page }) => {
      test.slow();

      await test.step('Navigate to marketplace', async () => {
        await navigateToMarketplace(page);
      });

      await test.step('Search for non-existent term', async () => {
        await searchMarketplace(page, 'xyznonexistent99999');
      });

      await test.step('Verify empty state message', async () => {
        await expect(page.locator('.marketplace-search-results')).toBeVisible();
        await expect(page.locator('.marketplace-search-results')).toContainText(
          'No data found'
        );
      });
    });

    test('Search popover dismisses when input is cleared', async ({ page }) => {
      test.slow();

      await test.step('Navigate to marketplace', async () => {
        await navigateToMarketplace(page);
      });

      await test.step('Search for an existing entity', async () => {
        await searchMarketplace(page, dp4.data.displayName);
        await expect(
          page.getByTestId(`search-result-dp-${dp4.responseData.id}`)
        ).toBeVisible();
      });

      await test.step('Clear input and verify popover closes', async () => {
        await closeSearchPopover(page);
      });
    });
  }
);
