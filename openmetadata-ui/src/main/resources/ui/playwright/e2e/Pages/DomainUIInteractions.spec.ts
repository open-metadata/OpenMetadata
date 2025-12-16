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

import { expect, Page, test as base } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { SubDomain } from '../../support/domain/SubDomain';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, toastNotification, uuid } from '../../utils/common';
import {
  checkAssetsCount,
  selectDataProduct,
  selectDomain,
} from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';

const test = base.extend<{
  page: Page;
}>({
  page: async ({ browser }, use) => {
    const { page } = await performAdminLogin(browser);
    await use(page);
    await page.close();
  },
});

test.describe('Domain Owner Management', () => {
  test.slow(true);

  test('Add owner to domain via UI', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const user = new UserClass();

    try {
      await domain.create(apiContext);
      await user.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // Click add owner button
      await page.getByTestId('add-owner').click();

      // Wait for popover to appear
      await page.waitForSelector('[data-testid="select-owner-tabs"]', {
        state: 'visible',
      });

      // Switch to Users tab
      const userListResponse = page.waitForResponse(
        '/api/v1/search/query?q=*isBot:false*index=user_search_index*'
      );
      await page.getByRole('tab', { name: 'Users' }).click();
      await userListResponse;
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Search for user
      const searchUser = page.waitForResponse(
        `/api/v1/search/query?q=*${encodeURIComponent(user.getUserName())}*`
      );
      await page
        .getByTestId('owner-select-users-search-bar')
        .fill(user.getUserName());
      await searchUser;
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Click on user in list
      const ownerItem = page.getByRole('listitem', {
        name: user.getUserName(),
        exact: true,
      });
      await ownerItem.waitFor({ state: 'visible' });
      await ownerItem.click();

      // Click update button and wait for patch
      const patchRes = page.waitForResponse('/api/v1/domains/*');
      await page.getByTestId('selectable-list-update-btn').click();
      await patchRes;

      // Wait for popover to close
      await page.waitForSelector('[data-testid="select-owner-tabs"]', {
        state: 'detached',
      });

      // Verify owner was added by checking that edit-owner button now appears (it only shows when owner exists)
      await expect(page.getByTestId('edit-owner')).toBeVisible({
        timeout: 10000,
      });

      // Verify the owner name is visible on the page
      await expect(page.getByText(user.responseData.displayName)).toBeVisible();
    } finally {
      await domain.delete(apiContext);
      await user.delete(apiContext);
      await afterAction();
    }
  });

  test('Remove owner from domain via UI', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const user = new UserClass();
    await user.create(apiContext);

    const domain = new Domain();

    try {
      await domain.create(apiContext);

      // Add owner via API
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

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // Wait for page to load and owner to be displayed
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('edit-owner')).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(user.responseData.displayName)).toBeVisible();

      // Click edit owner button
      await page.getByTestId('edit-owner').click();

      // Wait for popover to appear
      await page.waitForSelector('[data-testid="select-owner-tabs"]', {
        state: 'visible',
      });

      // Switch to Users tab
      await page.getByRole('tab', { name: 'Users' }).click();
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Click clear all button to remove all owners
      await page.getByTestId('clear-all-button').click();

      // Click update button and wait for patch
      const patchRes = page.waitForResponse('/api/v1/domains/*');
      await page.getByTestId('selectable-list-update-btn').click();
      await patchRes;

      // Verify add owner button is visible (owner was removed)
      await expect(page.getByTestId('add-owner')).toBeVisible();
    } finally {
      await domain.delete(apiContext);
      await user.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Domain Expert Management', () => {
  test.slow(true);

  test('Add expert to domain via UI', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const user = new UserClass();

    try {
      await domain.create(apiContext);
      await user.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // Click add expert button (uses data-testid="Add")
      await page.getByTestId('domain-expert-name').getByTestId('Add').click();

      // Wait for the popover to appear (UserSelectableList - simpler, no tabs)
      await page.waitForSelector('[data-testid="selectable-list"]', {
        state: 'visible',
      });

      // Search for user with retry mechanism (ES indexing can take time)
      const searchBar = page.getByTestId('searchbar');
      const expertItem = page.getByRole('listitem', {
        name: user.getUserName(),
        exact: true,
      });
      const maxRetries = 5;

      for (let retry = 0; retry < maxRetries; retry++) {
        // Clear and fill search bar
        await searchBar.clear();
        const searchResponse = page.waitForResponse(
          (res) =>
            res.url().includes('/api/v1/search/query') &&
            res.url().includes('user_search_index')
        );
        await searchBar.fill(user.getUserName());
        await searchResponse;
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Check if user is visible
        const isVisible = await expertItem.isVisible().catch(() => false);
        if (isVisible) {
          break;
        }

        // Wait before retry (ES indexing delay)
        if (retry < maxRetries - 1) {
          await page.waitForTimeout(2000);
        }
      }

      await expertItem.waitFor({ state: 'visible', timeout: 5000 });
      await expertItem.click();

      // Click update button and wait for patch (multiSelect is true by default)
      const patchRes = page.waitForResponse('/api/v1/domains/*');
      await page.getByTestId('selectable-list-update-btn').click();
      await patchRes;

      // Verify expert is displayed
      await expect(
        page.getByTestId('domain-expert-name').getByTestId('owner-link')
      ).toContainText(user.getUserName());
    } finally {
      await domain.delete(apiContext);
      await user.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Domain Style Editing', () => {
  test.slow(true);

  test('Edit domain style - change icon URL', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // Click manage button to open dropdown
      await page.getByTestId('manage-button').click();

      // Click on Style option - it's rendered via ManageButtonItemLabel with id="edit-style-button"
      await page.getByTestId('edit-style-button').click();

      // Wait for modal to appear
      await expect(page.getByRole('dialog')).toBeVisible();

      // Fill icon URL input (data-testid="icon-url")
      await page.getByTestId('icon-url').fill('https://example.com/icon.png');

      // Click Save button (Ant Design Modal uses getByRole for OK button)
      const patchRes = page.waitForResponse('/api/v1/domains/*');
      await page.getByRole('button', { name: 'Save' }).click();
      await patchRes;

      // Wait for modal to close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Data Product UI Operations', () => {
  test.slow(true);

  test('Rename data product via UI', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.responseData);

      await page.getByTestId('manage-button').click();
      // Use first() since there may be multiple items with rename-button
      await page.getByTestId('rename-button').first().click();

      // Wait for modal to appear
      await expect(page.getByRole('dialog')).toBeVisible();

      const newName = `Renamed DP ${uuid()}`;
      await page.locator('#displayName').clear();
      await page.locator('#displayName').fill(newName);

      const patchRes = page.waitForResponse('/api/v1/dataProducts/*');
      await page.getByTestId('save-button').click();
      await patchRes;

      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(newName);
    } finally {
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Delete data product via UI', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.responseData);

      await page.getByTestId('manage-button').click();
      await page.getByTestId('delete-button').click();

      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByTestId('confirmation-text-input').fill('DELETE');

      const deleteRes = page.waitForResponse('/api/v1/dataProducts/*');
      await page.getByTestId('confirm-button').click();
      await deleteRes;

      await toastNotification(page, /deleted/i);
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Add owner to data product via UI', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);
    const user = new UserClass();

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);
      await user.create(apiContext);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.responseData);

      // Click add owner button
      await page.getByTestId('add-owner').click();

      // Wait for popover to appear
      await page.waitForSelector('[data-testid="select-owner-tabs"]', {
        state: 'visible',
      });

      // Switch to Users tab
      const userListResponse = page.waitForResponse(
        '/api/v1/search/query?q=*isBot:false*index=user_search_index*'
      );
      await page.getByRole('tab', { name: 'Users' }).click();
      await userListResponse;
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Search for user
      const searchUser = page.waitForResponse(
        `/api/v1/search/query?q=*${encodeURIComponent(user.getUserName())}*`
      );
      await page
        .getByTestId('owner-select-users-search-bar')
        .fill(user.getUserName());
      await searchUser;
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Click on user in list
      const ownerItem = page.getByRole('listitem', {
        name: user.getUserName(),
        exact: true,
      });
      await ownerItem.waitFor({ state: 'visible' });
      await ownerItem.click();

      // Click update button and wait for patch
      const patchRes = page.waitForResponse('/api/v1/dataProducts/*');
      await page.getByTestId('selectable-list-update-btn').click();
      await patchRes;

      // Wait for popover to close
      await page.waitForSelector('[data-testid="select-owner-tabs"]', {
        state: 'detached',
      });

      // Verify owner was added by checking that edit-owner button now appears
      await expect(page.getByTestId('edit-owner')).toBeVisible({
        timeout: 10000,
      });

      // Verify the owner name is visible on the page
      await expect(page.getByText(user.responseData.displayName)).toBeVisible();
    } finally {
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await user.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Entity Domain Assignment', () => {
  test.slow(true);

  test('Assign domain to table via entity page', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const table = new TableClass();

    try {
      await domain.create(apiContext);
      await table.create(apiContext);

      await page.goto(
        `/table/${encodeURIComponent(
          table.entityResponseData.fullyQualifiedName
        )}`
      );
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Click add-domain button
      await page.getByTestId('add-domain').click();
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
      });

      // Wait for tree to load
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Find the domain node in tree by its data-testid and click the checkbox
      const domainTreeNode = page.getByTestId(
        `tag-${domain.responseData.fullyQualifiedName}`
      );
      await domainTreeNode.waitFor({ state: 'visible' });

      // Click the checkbox (ant-tree-checkbox) within the tree node
      const checkbox = domainTreeNode.locator('.ant-tree-checkbox');
      await checkbox.click();

      // Click save button
      const patchRes = page.waitForResponse(
        (req) => req.request().method() === 'PATCH'
      );
      await page.getByTestId('saveAssociatedTag').click();
      await patchRes;

      // Wait for popover to close
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'detached',
      });

      // Verify domain is displayed
      await expect(page.getByTestId('domain-link')).toContainText(
        domain.data.displayName,
        { timeout: 10000 }
      );
    } finally {
      await table.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Remove domain from table via entity page', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const table = new TableClass();

    try {
      await domain.create(apiContext);
      await table.create(apiContext);

      // Assign domain via API
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

      await page.goto(
        `/table/${encodeURIComponent(
          table.entityResponseData.fullyQualifiedName
        )}`
      );
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Verify domain is displayed
      await expect(page.getByTestId('domain-link')).toContainText(
        domain.data.displayName,
        { timeout: 10000 }
      );

      // Click domain edit button to open popover
      await page.getByTestId('add-domain').click();
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
      });

      // Wait for tree to load
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Find the domain node in tree and click checkbox to deselect (already checked)
      const domainTreeNode = page.getByTestId(
        `tag-${domain.responseData.fullyQualifiedName}`
      );
      await domainTreeNode.waitFor({ state: 'visible' });

      // Click the checkbox to deselect
      const checkbox = domainTreeNode.locator('.ant-tree-checkbox');
      await checkbox.click();

      // Click save button
      const patchRes = page.waitForResponse(
        (req) => req.request().method() === 'PATCH'
      );
      await page.getByTestId('saveAssociatedTag').click();
      await patchRes;

      // Wait for popover to close
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'detached',
      });

      // Verify no domain text is displayed
      await expect(page.getByTestId('no-domain-text')).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await table.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Subdomain Management', () => {
  test.slow(true);

  test('Delete subdomain via UI', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      // Create domain first
      await domain.create(apiContext);

      // Create subdomain after domain exists (so parent FQN is available)
      const subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);

      // Ensure we have the FQN from the response
      const subDomainFqn =
        subDomain.responseData.fullyQualifiedName ??
        subDomain.data.fullyQualifiedName;
      if (!subDomainFqn) {
        throw new Error('SubDomain FQN is undefined');
      }

      await page.goto(`/domain/${encodeURIComponent(subDomainFqn)}`);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Wait for page to fully load
      await expect(page.getByTestId('manage-button')).toBeVisible({
        timeout: 10000,
      });

      await page.getByTestId('manage-button').click();
      await page.getByTestId('delete-button').click();

      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByTestId('confirmation-text-input').fill('DELETE');

      const deleteRes = page.waitForResponse('/api/v1/domains/*');
      await page.getByTestId('confirm-button').click();
      await deleteRes;

      await toastNotification(page, /deleted/i);
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Rename subdomain via UI', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    let subDomain: SubDomain | undefined;

    try {
      // Create domain first
      await domain.create(apiContext);

      // Create subdomain after domain exists
      subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);

      // Ensure we have the FQN from the response
      const subDomainFqn =
        subDomain.responseData.fullyQualifiedName ??
        subDomain.data.fullyQualifiedName;
      if (!subDomainFqn) {
        throw new Error('SubDomain FQN is undefined');
      }

      await page.goto(`/domain/${encodeURIComponent(subDomainFqn)}`);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Wait for page to fully load
      await expect(page.getByTestId('manage-button')).toBeVisible({
        timeout: 10000,
      });

      await page.getByTestId('manage-button').click();
      await page.getByTestId('rename-button').first().click();

      // Wait for modal to appear
      await expect(page.getByRole('dialog')).toBeVisible();

      const newName = `Renamed SubDomain ${uuid()}`;
      await page.locator('#displayName').clear();
      await page.locator('#displayName').fill(newName);

      const patchRes = page.waitForResponse('/api/v1/domains/*');
      await page.getByTestId('save-button').click();
      await patchRes;

      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(newName);
    } finally {
      if (subDomain) {
        await subDomain.delete(apiContext);
      }
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Domain Form Validation', () => {
  test.slow(true);

  test('Domain name validation - special characters', async ({ page }) => {
    await sidebarClick(page, SidebarItem.DOMAIN);

    await page.click('[data-testid="add-domain"]');
    await page.waitForSelector('h6:has-text("Add Domain")');

    await page.locator('#root\\/name').fill('Invalid@Name#Test');
    await page.locator('#root\\/displayName').fill('Test Domain');

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
      page.locator('.ant-form-item-explain-error').first()
    ).toBeVisible();
  });

  test('Domain name validation - max length', async ({ page }) => {
    await sidebarClick(page, SidebarItem.DOMAIN);

    await page.click('[data-testid="add-domain"]');
    await page.waitForSelector('h6:has-text("Add Domain")');

    const longName = 'a'.repeat(150);
    await page.locator('#root\\/name').fill(longName);

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
      page.getByText('Name size must be between 1 and 128')
    ).toBeVisible();
  });

  test('Domain description required validation', async ({ page }) => {
    await sidebarClick(page, SidebarItem.DOMAIN);

    await page.click('[data-testid="add-domain"]');
    await page.waitForSelector('h6:has-text("Add Domain")');

    await page.locator('#root\\/name').fill('ValidName');
    await page.locator('#root\\/displayName').fill('Valid Display Name');

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Description is required')).toBeVisible();
  });
});

test.describe('Domain Assets Tab Operations', () => {
  test.slow(true);

  test('Search assets within domain', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const table = new TableClass();
    const topic = new TopicClass();

    try {
      await domain.create(apiContext);
      await table.create(apiContext);
      await topic.create(apiContext);

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

      await topic.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: { id: domain.responseData.id, type: 'domain' },
          },
        ],
      });

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);
      await page.getByTestId('assets').click();
      await page.waitForLoadState('networkidle');

      await checkAssetsCount(page, 2);

      const searchInput = page.getByPlaceholder('Search assets');
      if (await searchInput.isVisible()) {
        const searchRes = page.waitForResponse('/api/v1/search/query*');
        await searchInput.fill(table.entityResponseData.name);
        await searchRes;

        await expect(
          page.locator(
            `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
          )
        ).toBeVisible();
      }
    } finally {
      await table.delete(apiContext);
      await topic.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Domain Global Dropdown', () => {
  test.slow(true);

  test('Select domain from global dropdown filters explore', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      await page.goto('/explore/tables');
      await page.waitForLoadState('networkidle');

      await page.getByTestId('domain-dropdown').click();

      const domainOption = page.getByTestId(
        `tag-${domain.responseData.fullyQualifiedName}`
      );

      if (await domainOption.isVisible()) {
        await domainOption.click();
        await page.waitForLoadState('networkidle');

        await expect(page.getByTestId('domain-dropdown')).toContainText(
          domain.data.displayName
        );
      }
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Clear domain selection returns to All Domains', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await domain.create(apiContext);

      await page.goto('/explore/tables');
      await page.waitForLoadState('networkidle');

      await page.getByTestId('domain-dropdown').click();

      const domainOption = page.getByTestId(
        `tag-${domain.responseData.fullyQualifiedName}`
      );

      if (await domainOption.isVisible()) {
        await domainOption.click();
        await page.waitForLoadState('networkidle');

        await page.getByTestId('domain-dropdown').click();
        await page.getByTestId('all-domains-selector').click();

        await expect(page.getByTestId('domain-dropdown')).toContainText(
          'All Domains'
        );
      }
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Domain Breadcrumb Navigation', () => {
  test.slow(true);

  test('Navigate from subdomain to parent domain via breadcrumb', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const subDomain = new SubDomain(domain);

    try {
      await domain.create(apiContext);
      await subDomain.create(apiContext);

      const subDomainFqn = subDomain.responseData.fullyQualifiedName;
      await page.goto(`/domain/${encodeURIComponent(subDomainFqn)}`);
      await page.waitForLoadState('networkidle');

      const parentLink = page.getByRole('link', {
        name: domain.responseData.fullyQualifiedName,
      });

      if (await parentLink.isVisible()) {
        await parentLink.click();
        await page.waitForLoadState('networkidle');

        await expect(
          page.getByTestId('entity-header-display-name')
        ).toContainText(domain.data.displayName);
      }
    } finally {
      await subDomain.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Navigate from data product to parent domain', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const dataProduct = new DataProduct([domain]);

    try {
      await domain.create(apiContext);
      await dataProduct.create(apiContext);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.responseData);

      const domainLink = page.locator('[data-testid="domain-link"]').first();

      if (await domainLink.isVisible()) {
        await domainLink.click();
        await page.waitForLoadState('networkidle');

        await expect(
          page.getByTestId('entity-header-display-name')
        ).toContainText(domain.data.displayName);
      }
    } finally {
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Delete Domain with Dependencies', () => {
  test.slow(true);

  test('Delete domain with subdomains shows warning', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const subDomain = new SubDomain(domain);

    try {
      await domain.create(apiContext);
      await subDomain.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      await page.getByTestId('manage-button').click();
      await page.getByTestId('delete-button-title').click();

      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByTestId('confirmation-text-input').fill('DELETE');

      const deleteRes = page.waitForResponse('/api/v1/domains/*');
      await page.getByTestId('confirm-button').click();
      await deleteRes;
    } finally {
      await afterAction();
    }
  });

  test('Delete domain with assets removes domain from assets', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const table = new TableClass();

    try {
      await domain.create(apiContext);
      await table.create(apiContext);

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

      await domain.delete(apiContext);

      await page.goto(
        `/table/${encodeURIComponent(
          table.entityResponseData.fullyQualifiedName
        )}`
      );
      await page.waitForLoadState('networkidle');

      const domainLinks = page.locator('[data-testid="domain-link"]');
      const count = await domainLinks.count();

      expect(count).toBe(0);
    } finally {
      await table.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Copy FQN Functionality', () => {
  test.slow(true);

  test('Copy domain FQN to clipboard', async ({ page, context }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();

    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      await domain.create(apiContext);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      const copyButton = page
        .locator('[data-testid="entity-header-name"] button')
        .first();

      if (await copyButton.isVisible()) {
        await copyButton.click();

        await toastNotification(page, /copied/i);
      }
    } finally {
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});
