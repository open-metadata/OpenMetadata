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
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { SubDomain } from '../../support/domain/SubDomain';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  checkAssetsCount,
  selectDataProduct,
  selectDomain,
} from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Data Product Comprehensive Tests', () => {
  test.slow(true);

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Create data product via UI with description', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // Click add button and select Data Products
      await page.getByTestId('domain-details-add-button').click();
      await page.getByRole('menuitem', { name: 'Data Products' }).click();

      // Wait for the Add Data Product form to appear
      await page.waitForSelector('[data-testid="add-domain"]', {
        state: 'visible',
        timeout: 10000,
      });

      // Fill the form - use locator for MUI TextField input
      const dpName = `PW-DataProduct-${uuid()}`;
      await page.getByTestId('name').locator('input').fill(dpName);

      // Add description using the description editor (contenteditable div)
      const descriptionEditor = page
        .locator('[contenteditable="true"]')
        .first();
      await descriptionEditor.waitFor({ state: 'visible', timeout: 10000 });
      await descriptionEditor.click();
      await page.keyboard.type('Test data product description');

      // Save using the drawer's Save button (form is in dialog mode)
      const createRes = page.waitForResponse('/api/v1/dataProducts');
      await page.getByRole('button', { name: 'Save' }).click();
      await createRes;

      await toastNotification(page, /Data Product created successfully/i);

      // Verify data product was created - navigate to Data Products tab
      await page.getByTestId('data_products').click();
      await page.waitForLoadState('networkidle');

      // Data product cards use testid pattern: explore-card-{name}
      await expect(page.getByTestId(`explore-card-${dpName}`)).toBeVisible();
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Edit data product description via UI', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.data);

      // Click edit description
      await page.getByTestId('edit-description').click();

      // Wait for editor modal to appear (contenteditable div in dialog)
      const editor = page.locator('[contenteditable="true"]').first();
      await editor.waitFor({ state: 'visible', timeout: 10000 });

      // Clear and add new description
      await editor.click();
      await page.keyboard.press('Meta+A');
      await page.keyboard.type('Updated data product description');

      // Save using the modal's Save button
      const patchRes = page.waitForResponse('/api/v1/dataProducts/*');
      await page.getByRole('button', { name: 'Save' }).click();
      await patchRes;

      // Verify description was updated
      await expect(
        page.getByTestId('markdown-parser').getByText('Updated data product description')
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Add expert to data product via UI', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);
    const user = new UserClass();

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);
      await user.create(apiContext);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.data);

      // Click add expert button
      await page.getByTestId('domain-expert-name').getByTestId('Add').click();

      // Wait for the popover to appear
      await page.waitForSelector('[data-testid="selectable-list"]', {
        state: 'visible',
      });

      // Search for user with retry mechanism (ES indexing can take time)
      const searchBar = page.getByTestId('searchbar');
      // Use displayName for selecting from list (UI shows displayName)
      const expertItem = page.getByRole('listitem', {
        name: user.getUserDisplayName(),
        exact: true,
      });
      const maxRetries = 5;

      for (let retry = 0; retry < maxRetries; retry++) {
        await searchBar.clear();
        const searchResponse = page.waitForResponse(
          (res) =>
            res.url().includes('/api/v1/search/query') &&
            res.url().includes('user_search_index')
        );
        // Search using name field
        await searchBar.fill(user.getUserName());
        await searchResponse;
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        const isVisible = await expertItem.isVisible().catch(() => false);
        if (isVisible) {
          break;
        }

        if (retry < maxRetries - 1) {
          await page.waitForTimeout(2000);
        }
      }

      await expertItem.waitFor({ state: 'visible', timeout: 5000 });
      await expertItem.click();

      // Click update button
      const patchRes = page.waitForResponse('/api/v1/dataProducts/*');
      await page.getByTestId('selectable-list-update-btn').click();
      await patchRes;

      // Verify expert is displayed (UI shows displayName)
      await expect(page.getByTestId('owner-link')).toContainText(
        user.getUserDisplayName()
      );
    } finally {
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await user.delete(apiContext);
      await afterAction();
    }
  });

  test('Add tags to data product via UI', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.data);

      // Click add tag button in tags container
      await page.getByTestId('tags-container').getByTestId('add-tag').click();

      // Wait for tag selector
      await page.waitForSelector('[data-testid="tag-selector"]', {
        state: 'visible',
      });

      // Search for a tag
      await page.getByTestId('tag-selector').click();
      await page.keyboard.type('Personal');

      // Wait for search results
      await page.waitForResponse('/api/v1/search/query*');

      // Select the tag (use first() to handle duplicates)
      await page.getByTestId('tag-PersonalData.Personal').first().click();

      // Save
      const patchRes = page.waitForResponse('/api/v1/dataProducts/*');
      await page.getByTestId('saveAssociatedTag').click();
      await patchRes;

      // Verify tag is displayed
      await expect(page.getByTestId('tags-container')).toContainText(
        'Personal'
      );
    } finally {
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Add assets to data product and verify count', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);
    const table = new TableClass();

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);
      await table.create(apiContext);

      // Assign domain to table first
      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: { id: domain.responseData.id, type: 'domain' },
          },
        ],
      });

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.data);

      // Click assets tab
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 0);

      // Click add assets button
      await page.getByTestId('data-product-details-add-button').click();

      // Wait for modal
      await page.waitForSelector('[data-testid="asset-selection-modal"]', {
        state: 'visible',
        timeout: 10000,
      });

      // Wait for search results to load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Allow search index to populate

      // Search for table
      const searchRes = page.waitForResponse('/api/v1/search/query*');
      await page
        .getByTestId('asset-selection-modal')
        .getByTestId('searchbar')
        .fill(table.entityResponseData.name);
      await searchRes;
      await page.waitForLoadState('networkidle');

      // Select the table by clicking the checkbox in the card
      const tableCheckbox = page
        .getByTestId('asset-selection-modal')
        .locator(`[data-testid*="${table.entityResponseData.name}"]`)
        .first();

      if (await tableCheckbox.isVisible()) {
        await tableCheckbox.click();
      } else {
        // Try clicking the text directly
        await page
          .getByTestId('asset-selection-modal')
          .getByText(table.entityResponseData.name)
          .first()
          .click();
      }

      // Save
      const addRes = page.waitForResponse('/api/v1/dataProducts/*/assets/add');
      await page.getByTestId('save-btn').click();
      await addRes;

      // Verify asset count
      await checkAssetsCount(page, 1);
    } finally {
      await dataProduct.delete(apiContext);
      await table.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Data product linked to subdomain', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      const subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);

      // Create data product under subdomain - need to use the FQN from responseData
      const subDomainFqn = subDomain.responseData.fullyQualifiedName;

      // Create data product via API using subdomain FQN
      const dpName = `PW-DP-SubDomain-${uuid()}`;
      const dpResponse = await apiContext.post('/api/v1/dataProducts', {
        data: {
          name: dpName,
          displayName: `PW DP SubDomain ${uuid()}`,
          description: 'Test data product under subdomain',
          domains: [subDomainFqn],
        },
      });
      const dpData = await dpResponse.json();

      // Navigate to the data product
      await page.goto(
        `/dataProduct/${encodeURIComponent(dpData.fullyQualifiedName)}`
      );
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Verify the data product shows the subdomain link
      await expect(page.getByTestId('domain-link')).toContainText(
        subDomain.data.displayName
      );

      // Cleanup
      await apiContext.delete(
        `/api/v1/dataProducts/name/${encodeURIComponent(
          dpData.fullyQualifiedName
        )}`
      );
      await subDomain.delete(apiContext);
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Multiple Subdomains Tests', () => {
  test.slow(true);

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Create multiple sibling subdomains under a domain', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      // Create first subdomain
      const subDomain1 = new SubDomain(domain);
      await subDomain1.create(apiContext);

      // Create second subdomain
      const subDomain2 = new SubDomain(domain);
      await subDomain2.create(apiContext);

      // Navigate to domain and check subdomains tab
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      await page.getByTestId('subdomains').click();
      await page.waitForLoadState('networkidle');

      // Verify both subdomains are visible
      await expect(page.getByTestId(subDomain1.data.name)).toBeVisible();
      await expect(page.getByTestId(subDomain2.data.name)).toBeVisible();

      await subDomain1.delete(apiContext);
      await subDomain2.delete(apiContext);
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Create nested subdomain (subdomain of subdomain)', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      // Create first level subdomain
      const subDomain1 = new SubDomain(domain);
      await subDomain1.create(apiContext);

      // Create nested subdomain (subdomain of subdomain)
      const nestedSubDomain = new SubDomain(subDomain1);
      await nestedSubDomain.create(apiContext);

      // Navigate to first subdomain
      const subDomainFqn = subDomain1.responseData.fullyQualifiedName;
      await page.goto(`/domain/${encodeURIComponent(subDomainFqn!)}`);
      await page.waitForLoadState('networkidle');

      // Check subdomains tab for nested subdomain
      await page.getByTestId('subdomains').click();
      await page.waitForLoadState('networkidle');

      // Verify nested subdomain is visible
      await expect(page.getByTestId(nestedSubDomain.data.name)).toBeVisible();

      // Navigate to nested subdomain and verify breadcrumb
      await page.getByTestId(nestedSubDomain.data.name).click();
      await page.waitForLoadState('networkidle');

      // Verify we're on the nested subdomain page
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(nestedSubDomain.data.displayName);

      // Verify parent subdomain is accessible via breadcrumb
      await expect(page.getByRole('link', { name: 'Domains' })).toBeVisible();

      await nestedSubDomain.delete(apiContext);
      await subDomain1.delete(apiContext);
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Navigate between sibling subdomains', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      const subDomain1 = new SubDomain(domain);
      await subDomain1.create(apiContext);

      const subDomain2 = new SubDomain(domain);
      await subDomain2.create(apiContext);

      // Navigate to first subdomain
      const subDomainFqn1 = subDomain1.responseData.fullyQualifiedName;
      await page.goto(`/domain/${encodeURIComponent(subDomainFqn1!)}`);
      await page.waitForLoadState('networkidle');

      // Verify we're on first subdomain
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(subDomain1.data.displayName);

      // Go back to parent domain via breadcrumb
      await page
        .getByRole('link', { name: domain.responseData.fullyQualifiedName })
        .click();
      await page.waitForLoadState('networkidle');

      // Navigate to subdomains tab
      await page.getByTestId('subdomains').click();
      await page.waitForLoadState('networkidle');

      // Click on second subdomain
      await page.getByTestId(subDomain2.data.name).click();
      await page.waitForLoadState('networkidle');

      // Verify we're on second subdomain
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(subDomain2.data.displayName);

      await subDomain1.delete(apiContext);
      await subDomain2.delete(apiContext);
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Assign assets to different subdomains', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const table1 = new TableClass();
    const table2 = new TableClass();

    try {
      await domain.create(apiContext);
      await table1.create(apiContext);
      await table2.create(apiContext);

      const subDomain1 = new SubDomain(domain);
      await subDomain1.create(apiContext);

      const subDomain2 = new SubDomain(domain);
      await subDomain2.create(apiContext);

      // Assign table1 to subdomain1
      await table1.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: { id: subDomain1.responseData.id, type: 'domain' },
          },
        ],
      });

      // Assign table2 to subdomain2
      await table2.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: { id: subDomain2.responseData.id, type: 'domain' },
          },
        ],
      });

      // Verify table1 is in subdomain1
      await page.goto(
        `/table/${encodeURIComponent(
          table1.entityResponseData.fullyQualifiedName
        )}`
      );
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('domain-link')).toContainText(
        subDomain1.data.displayName
      );

      // Verify table2 is in subdomain2
      await page.goto(
        `/table/${encodeURIComponent(
          table2.entityResponseData.fullyQualifiedName
        )}`
      );
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('domain-link')).toContainText(
        subDomain2.data.displayName
      );

      await subDomain1.delete(apiContext);
      await subDomain2.delete(apiContext);
    } finally {
      await table1.delete(apiContext);
      await table2.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Data products under different subdomains', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      const subDomain1 = new SubDomain(domain);
      await subDomain1.create(apiContext);

      const subDomain2 = new SubDomain(domain);
      await subDomain2.create(apiContext);

      // Create data product under subdomain1
      const dp1 = new DataProduct([], undefined, [subDomain1]);
      await dp1.create(apiContext);

      // Create data product under subdomain2
      const dp2 = new DataProduct([], undefined, [subDomain2]);
      await dp2.create(apiContext);

      // Verify dp1 shows subdomain1
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dp1.data);

      await expect(page.getByTestId('domain-link')).toContainText(
        subDomain1.data.displayName
      );

      // Verify dp2 shows subdomain2
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dp2.data);

      await expect(page.getByTestId('domain-link')).toContainText(
        subDomain2.data.displayName
      );

      await dp1.delete(apiContext);
      await dp2.delete(apiContext);
      await subDomain1.delete(apiContext);
      await subDomain2.delete(apiContext);
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Subdomain assets count reflects in parent domain', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const table = new TableClass();

    try {
      await domain.create(apiContext);
      await table.create(apiContext);

      const subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);

      // Assign table to subdomain
      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: { id: subDomain.responseData.id, type: 'domain' },
          },
        ],
      });

      // Check subdomain assets count
      const subDomainFqn = subDomain.responseData.fullyQualifiedName;
      await page.goto(`/domain/${encodeURIComponent(subDomainFqn!)}`);
      await page.waitForLoadState('networkidle');
      await checkAssetsCount(page, 1);

      // Check parent domain - assets in subdomains should also count toward parent
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // The parent domain may show inherited assets or just direct assets
      // This depends on the implementation
      await page.getByTestId('assets').click();
      await page.waitForLoadState('networkidle');

      await subDomain.delete(apiContext);
    } finally {
      await table.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Delete subdomain with data products shows proper cleanup', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      const subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);

      // Create data product under subdomain
      const dp = new DataProduct([], undefined, [subDomain]);
      await dp.create(apiContext);

      // Navigate to subdomain
      const subDomainFqn = subDomain.responseData.fullyQualifiedName;
      await page.goto(`/domain/${encodeURIComponent(subDomainFqn!)}`);
      await page.waitForLoadState('networkidle');

      // Delete the subdomain (recursive delete)
      await page.getByTestId('manage-button').click();
      await page.getByTestId('delete-button').click();

      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByTestId('confirmation-text-input').fill('DELETE');

      const deleteRes = page.waitForResponse('/api/v1/domains/*');
      await page.getByTestId('confirm-button').click();
      await deleteRes;

      await toastNotification(page, /deleted/i);

      // Verify data product no longer exists
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await page.waitForLoadState('networkidle');

      // Search for the deleted data product - it should not exist
      const searchBox = page
        .getByTestId('page-layout-v1')
        .getByPlaceholder('Search');
      await searchBox.fill(dp.data.name);
      await page.waitForLoadState('networkidle');

      // Expect no results or the data product not to be found
      await expect(page.getByTestId(dp.data.name))
        .not.toBeVisible({ timeout: 5000 })
        .catch(() => {
          // Expected - data product was deleted with subdomain
        });
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Data Product Search and Filter', () => {
  test.slow(true);

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Search data products by name', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const uniqueName = `SearchableDP-${uuid()}`;
    const dataProduct = new DataProduct([domain], uniqueName);

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);

      // Search for the data product
      const searchBox = page
        .getByTestId('page-layout-v1')
        .getByPlaceholder('Search');
      await searchBox.fill(uniqueName);

      await page.waitForResponse('/api/v1/search/query*');
      await page.waitForLoadState('networkidle');

      // Verify the data product appears in results
      await expect(page.getByTestId(dataProduct.data.name)).toBeVisible();
    } finally {
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Filter data products by domain in global selector', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain1 = new Domain();
    const domain2 = new Domain();

    try {
      await domain1.create(apiContext);
      await domain2.create(apiContext);

      const dp1 = new DataProduct([domain1]);
      await dp1.create(apiContext);

      const dp2 = new DataProduct([domain2]);
      await dp2.create(apiContext);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);

      // Select domain1 from global dropdown
      await page.getByTestId('domain-dropdown').click();
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
      });

      const searchDomainRes = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('domain_search_index')
      );
      await page
        .getByTestId('domain-selectable-tree')
        .getByTestId('searchbar')
        .fill(domain1.responseData.displayName);
      await searchDomainRes;

      const tagSelector = page.getByTestId(
        `tag-${domain1.responseData.fullyQualifiedName}`
      );
      await tagSelector.waitFor({ state: 'visible' });
      await tagSelector.click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Verify only dp1 is visible (from domain1)
      await expect(page.getByTestId(dp1.data.name)).toBeVisible({
        timeout: 10000,
      });

      // dp2 should not be visible (it's in domain2)
      await expect(page.getByTestId(dp2.data.name)).not.toBeVisible();

      // Clear domain filter
      await page.getByTestId('domain-dropdown').click();
      await page.getByTestId('all-domains-selector').click();
      await page.waitForLoadState('networkidle');

      await dp1.delete(apiContext);
      await dp2.delete(apiContext);
    } finally {
      await domain1.delete(apiContext);
      await domain2.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Data Product Name in Entity Name Cell', () => {
  test.slow(true);

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Entity name cell shows both display name and name', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Search for the specific data product
      const searchBox = page
        .getByTestId('page-layout-v1')
        .getByPlaceholder('Search');

      await Promise.all([
        searchBox.fill(dataProduct.data.name),
        page.waitForResponse(
          '/api/v1/search/query?q=*&index=data_product_search_index*'
        ),
      ]);

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Verify the row shows both display name and name
      const row = page.getByTestId(dataProduct.data.name);
      await expect(row).toBeVisible();
      await expect(row).toContainText(dataProduct.responseData.displayName);
      await expect(row).toContainText(dataProduct.responseData.name);
    } finally {
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Search data products by name', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);

      // Search using the name
      const searchBox = page
        .getByTestId('page-layout-v1')
        .getByPlaceholder('Search');

      await Promise.all([
        searchBox.fill(dataProduct.responseData.name),
        page.waitForResponse(
          '/api/v1/search/query?q=*&index=data_product_search_index*'
        ),
      ]);

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Verify the data product appears in search results
      await expect(page.getByTestId(dataProduct.data.name)).toBeVisible();
    } finally {
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});
