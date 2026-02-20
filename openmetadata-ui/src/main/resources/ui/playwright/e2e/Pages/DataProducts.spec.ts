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

import base, { expect, Page } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  descriptionBox,
  redirectToHomePage,
} from '../../utils/common';
import {
  addAssetsToDataProduct,
  createDataProductFromListPage,
  removeAssetsFromDataProduct,
  selectDataProduct,
} from '../../utils/domain';
import { followEntity, waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import { selectTagInMUITagSuggestion } from '../../utils/tag';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';

const user = new UserClass();
const domain = new Domain();
const classification = new ClassificationClass({
  provider: 'system',
  mutuallyExclusive: true,
});
const tag = new TagClass({
  classification: classification.data.name,
});
const glossary = new Glossary();
const glossaryTerm = new GlossaryTerm(glossary);

const test = base.extend<{
  page: Page;
  userPage: Page;
}>({
  page: async ({ browser }, setPage) => {
    const { page } = await performAdminLogin(browser);
    await setPage(page);
    await page.close();
  },
  userPage: async ({ browser }, setPage) => {
    const page = await browser.newPage();
    await user.login(page);
    await setPage(page);
    await page.close();
  },
});

test.describe('Data Products', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.create(apiContext);
    await classification.create(apiContext);
    await tag.create(apiContext);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await domain.create(apiContext);

    await domain.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/owners/0',
          value: {
            id: user.responseData.id,
            type: 'user',
          },
        },
      ],
    });

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Data Product List Page - Initial Load', async ({ page }) => {
    await test.step('Navigate to Data Products page', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
    });

    await test.step('Verify page header and controls', async () => {
      await expect(
        page.getByRole('heading', { name: 'Data Products' })
      ).toBeVisible();
      await expect(
        page.getByRole('main').getByPlaceholder('Search')
      ).toBeVisible();
      await expect(page.getByTestId('add-entity-button')).toBeVisible();
    });

    await test.step('Verify view toggle buttons', async () => {
      await expect(page.locator('button[title="table"]')).toBeVisible();
      await expect(page.locator('button[title="card"]')).toBeVisible();
    });
  });

  test('Create Data Product and Manage Assets', async ({ page }) => {
    const dataProduct = new DataProduct([domain]);
    const table = new TableClass();

    await test.step('Setup test assets', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );
      await table.create(apiContext);
      // Assign table to domain so it appears in data product asset selection
      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: domain.responseData.id,
              type: 'domain',
            },
          },
        ],
      });
      await afterAction();
    });

    await test.step('Navigate to Data Products page', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Create new data product', async () => {
      await createDataProductFromListPage(page, dataProduct.data, domain.data);
    });

    await test.step('Open data product details', async () => {
      await selectDataProduct(page, dataProduct.data);
      await page.waitForLoadState('networkidle');

      // Verify we're on the data product details page
      await expect(page.getByTestId('entity-header-display-name')).toHaveText(
        dataProduct.data.displayName
      );
    });

    await test.step('Add assets to data product', async () => {
      await page.getByTestId('assets').click();
      await addAssetsToDataProduct(
        page,
        dataProduct.data.fullyQualifiedName ?? dataProduct.data.name,
        [table]
      );
    });

    await test.step('Verify asset count', async () => {
      await waitForAllLoadersToDisappear(page);
      const assetCount = await page
        .getByTestId('assets')
        .getByTestId('count')
        .textContent();
      expect(assetCount).toBe('1');
    });

    await test.step('Remove assets from data product', async () => {
      await removeAssetsFromDataProduct(page, dataProduct.data, [table]);
    });

    await test.step('Delete data product', async () => {
      await page.getByTestId('manage-button').click();
      await page.getByTestId('delete-button-title').click();

      await expect(
        page.getByTestId('modal-header').getByText(dataProduct.data.name)
      ).toBeVisible();

      await page.getByTestId('confirmation-text-input').fill('DELETE');

      const deleteRes = page.waitForResponse('/api/v1/dataProducts/*');
      await page.getByTestId('confirm-button').click();
      await deleteRes;
    });

    await test.step('Cleanup test assets', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );
      await table.delete(apiContext);
      await afterAction();
    });
  });

  test('Search Data Products', async ({ page }) => {
    const dataProduct1 = new DataProduct([domain]);
    const dataProduct2 = new DataProduct([domain]);

    await test.step('Create test data products', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );
      await dataProduct1.create(apiContext);
      await dataProduct2.create(apiContext);
      await afterAction();
    });

    await test.step('Navigate to Data Products page', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Search for specific data product', async () => {
      await page
        .getByRole('main')
        .getByPlaceholder('Search')
        .fill(dataProduct1.data.name);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByText(dataProduct1.data.displayName)).toBeVisible();
      await expect(
        page.getByText(dataProduct2.data.displayName)
      ).not.toBeVisible();
    });

    await test.step('Clear search', async () => {
      await page.getByRole('main').getByPlaceholder('Search').clear();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByTestId('pagination')).toBeVisible();
    });

    await test.step('Cleanup test data products', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );
      await dataProduct1.delete(apiContext);
      await dataProduct2.delete(apiContext);
      await afterAction();
    });
  });

  test('View Toggle - Table and Card Views', async ({ page }) => {
    const dataProduct = new DataProduct([domain]);

    await test.step('Create test data product', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );
      await dataProduct.create(apiContext);
      await afterAction();
    });

    await test.step('Navigate to Data Products page', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify table view is default', async () => {
      // Table should be visible with rows and column headers
      await expect(page.getByTestId('table-view-container')).toBeVisible();
    });

    await test.step('Switch to card view', async () => {
      await page.getByTestId('card-view-toggle').click();
      await page.waitForLoadState('networkidle');

      // Table should be hidden, cards should be visible
      await expect(page.getByTestId('table-view-container')).not.toBeVisible();
      await expect(page.getByTestId('card-view-container')).toBeVisible();
      await expect(page.getByTestId('entity-card').first()).toBeVisible();
    });

    await test.step('Switch back to table view', async () => {
      await page.getByTestId('table-view-toggle').click();
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('card-view-container')).not.toBeVisible();
      await expect(page.getByTestId('table-view-container')).toBeVisible();
    });

    await test.step('Cleanup test data product', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );
      await dataProduct.delete(apiContext);
      await afterAction();
    });
  });

  test('Pagination', async ({ page }) => {
    const dataProducts: DataProduct[] = [];

    await test.step('Create 30 test data products', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );

      for (let i = 0; i < 30; i++) {
        const dp = new DataProduct([domain]);
        await dp.create(apiContext);
        dataProducts.push(dp);
      }

      await afterAction();
    });

    await test.step('Navigate to Data Products page', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify pagination controls are visible', async () => {
      const pagination = page.getByTestId('pagination');
      await expect(pagination).toBeVisible();
      await expect(
        pagination.getByRole('button', { name: 'page 1', exact: true })
      ).toBeVisible();
    });

    await test.step('Navigate to page 2', async () => {
      await page.getByTestId('next').click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page
          .getByTestId('pagination')
          .getByRole('button', { name: 'page 2', exact: true })
      ).toBeVisible();
    });

    await test.step('Navigate back to page 1', async () => {
      await page.getByTestId('previous').click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page
          .getByTestId('pagination')
          .getByRole('button', { name: 'page 1', exact: true })
      ).toBeVisible();
    });

    await test.step('Cleanup test data products', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );

      for (const dp of dataProducts) {
        await dp.delete(apiContext);
      }

      await afterAction();
    });
  });

  test('Empty State - No Data Products', async ({ page }) => {
    await test.step('Mock API to return empty data products list', async () => {
      // Mock the search API to simulate empty state without deleting real data
      await page.route('**/api/v1/search/query*', async (route, request) => {
        const url = new URL(request.url());
        const index = url.searchParams.get('index');

        // Only mock data_product_search_index requests
        if (index === 'data_product_search_index') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              hits: {
                total: { value: 0 },
                hits: [],
              },
              aggregations: {},
            }),
          });
        } else {
          await route.continue();
        }
      });
    });

    await test.step('Navigate to Data Products page', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify empty state is shown', async () => {
      await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
      await expect(page.getByTestId('data-product-add-button')).toBeVisible();
    });

    await test.step('Click add button from empty state', async () => {
      await page.getByTestId('data-product-add-button').click();

      await expect(
        page.getByRole('heading', { name: /add data product/i })
      ).toBeVisible();
    });
  });

  test('Data Product - Follow/Unfollow', async ({ page }) => {
    const dataProduct = new DataProduct([domain]);

    await test.step('Create test data product', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );
      await dataProduct.create(apiContext);
      await afterAction();
    });

    await test.step('Navigate to data product details', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await selectDataProduct(page, dataProduct.data);
      await page.waitForLoadState('networkidle');
    });

    await test.step('Follow data product', async () => {
      await followEntity(page, EntityTypeEndpoint.DATA_PRODUCT);
    });

    await test.step('Verify follow button is changed to unfollow', async () => {
      const followButton = await page.getByTestId('entity-follow-button');
      await expect(followButton).toContainText('Unfollow');
    });

    await test.step('Cleanup test data product', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );
      await dataProduct.delete(apiContext);
      await afterAction();
    });
  });

  test('Create data product with tags using MUITagSuggestion', async ({
    page,
  }) => {
    const dataProduct = new DataProduct([domain]);

    await test.step('Navigate to add data product', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('add-entity-button').click();
      await expect(page.getByTestId('form-heading')).toContainText(
        'Add Data Product'
      );
    });

    await test.step('Fill data product form', async () => {
      await page.locator('#root\\/name').fill(dataProduct.data.name);
      await page
        .locator('#root\\/displayName')
        .fill(dataProduct.data.displayName);
      await page.locator(descriptionBox).fill(dataProduct.data.description);

      const domainInput = page.getByTestId('domain-select');
      await domainInput.scrollIntoViewIfNeeded();
      await domainInput.waitFor({ state: 'visible' });
      await domainInput.click();
      const searchDomain = page.waitForResponse(
        '/api/v1/search/query?q=*index=domain_search_index*'
      );
      await domainInput.fill(domain.data.displayName);
      await searchDomain;
      const domainOption = page.getByText(domain.data.displayName);
      await domainOption.waitFor({ state: 'visible' });
      await domainOption.click();
    });

    await test.step('Search and select tag via MUITagSuggestion', async () => {
      await selectTagInMUITagSuggestion(page, {
        searchTerm: tag.data.displayName,
        tagFqn: tag.responseData.fullyQualifiedName,
      });

      await expect(page.locator('[data-testid="tag-suggestion"]')).toContainText(
        tag.data.displayName
      );
    });

    await test.step('Save and verify tag is applied', async () => {
      const dpRes = page.waitForResponse('/api/v1/dataProducts');
      await page.getByTestId('save-btn').click();
      await dpRes;

      await selectDataProduct(page, dataProduct.data);

      await expect(
        page.locator(
          `[data-testid="tag-${tag.responseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();
    });

    await test.step('Cleanup', async () => {
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );
      await dataProduct.delete(apiContext);
      await afterAction();
    });
  });
});
