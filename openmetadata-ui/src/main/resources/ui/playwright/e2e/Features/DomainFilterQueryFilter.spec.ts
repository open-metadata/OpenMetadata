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
import { get } from 'lodash';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { SubDomain } from '../../support/domain/SubDomain';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { performAdminLogin } from '../../utils/admin';
import {
  getApiContext,
  redirectToExplorePage,
  redirectToHomePage,
} from '../../utils/common';
import {
  checkAssetsCount,
  selectDomain,
  verifyActiveDomainIsDefault,
} from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const { page } = await performAdminLogin(browser);
    await use(page);
    await page.close();
  },
});

test.describe('Domain Filter - User Behavior Tests', () => {
  test.slow(true);

  test('Assets from selected domain should be visible in explore page', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const domainTable = new TableClass();
    const nonDomainTable = new TableClass();

    try {
      // Create domain and tables
      await domain.create(apiContext);
      await domainTable.create(apiContext);
      await nonDomainTable.create(apiContext);

      // Assign domainTable to the domain
      await domainTable.patch({
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

      // Navigate to explore page first (domain dropdown not visible on home page)
      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      // Select domain from navbar
      await page.getByTestId('domain-dropdown').click();
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
      });

      const searchDomainRes1 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('domain_search_index')
      );
      await page
        .getByTestId('domain-selectable-tree')
        .getByTestId('searchbar')
        .fill(domain.responseData.displayName);
      await searchDomainRes1;

      // Wait for the tag element to be visible before clicking
      const tagSelector1 = page.getByTestId(
        `tag-${domain.responseData.fullyQualifiedName}`
      );
      await tagSelector1.waitFor({ state: 'visible' });
      await tagSelector1.click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Search for domain table - should be visible
      const domainTableName = get(
        domainTable,
        'entityResponseData.displayName',
        domainTable.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(domainTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // Search for non-domain table - should NOT be visible
      const nonDomainTableName = get(
        nonDomainTable,
        'entityResponseData.displayName',
        nonDomainTable.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(nonDomainTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // The non-domain table should not appear in results when domain is selected
      await expect(
        page.locator(
          `[data-testid="table-data-card_${nonDomainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).not.toBeVisible();
    } finally {
      await domainTable.delete(apiContext);
      await nonDomainTable.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Subdomain assets should be visible when parent domain is selected', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const parentDomainTable = new TableClass();
    const subDomainTable = new TableClass();

    let subDomain: SubDomain | undefined;

    try {
      // Create domain and subdomain
      await domain.create(apiContext);
      subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);


      // Create tables
      await parentDomainTable.create(apiContext);
      await subDomainTable.create(apiContext);

      // Assign parentDomainTable to parent domain
      await parentDomainTable.patch({
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

      await subDomainTable.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: subDomain.responseData.id,
              type: 'domain',
            },
          },
        ],
      });


      // Navigate to explore page first (domain dropdown not visible on home page)
      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      // Select the parent domain from navbar
      await page.getByTestId('domain-dropdown').click();
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
      });

      const searchDomainRes3 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('domain_search_index')
      );
      await page
        .getByTestId('domain-selectable-tree')
        .getByTestId('searchbar')
        .fill(domain.responseData.displayName);
      await searchDomainRes3;

      // Wait for the tag element to be visible before clicking
      const tagSelector3 = page.getByTestId(
        `tag-${domain.responseData.fullyQualifiedName}`
      );
      await tagSelector3.waitFor({ state: 'visible' });
      await tagSelector3.click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle')

      // Search for parent domain table - should be visible
      const parentTableName = get(
        parentDomainTable,
        'entityResponseData.displayName',
        parentDomainTable.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(parentTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${parentDomainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // Search for subdomain table - should ALSO be visible (prefix matching)
      const subTableName = get(
        subDomainTable,
        'entityResponseData.displayName',
        subDomainTable.entityResponseData.name
      );
      console.log((subDomainTable.entityResponseData as any).domains)
      await page.getByTestId('searchBox').fill(subTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${subDomainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await parentDomainTable.delete(apiContext);
      await subDomainTable.delete(apiContext);
      if (subDomain) {
        await subDomain.delete(apiContext);
      }
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Domain filter should persist across page navigation', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const domainTable = new TableClass();
    const nonDomainTable = new TableClass();

    try {
      // Create domain and tables
      await domain.create(apiContext);
      await domainTable.create(apiContext);
      await nonDomainTable.create(apiContext);

      // Assign domainTable to the domain
      await domainTable.patch({
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

      // Navigate to explore page first (domain dropdown not visible on home page)
      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      // Select domain from navbar
      await page.getByTestId('domain-dropdown').click();
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
      });

      const searchDomainRes4 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('domain_search_index')
      );
      await page
        .getByTestId('domain-selectable-tree')
        .getByTestId('searchbar')
        .fill(domain.responseData.displayName);
      await searchDomainRes4;

      // Wait for the tag element to be visible before clicking
      const tagSelector4 = page.getByTestId(
        `tag-${domain.responseData.fullyQualifiedName}`
      );
      await tagSelector4.waitFor({ state: 'visible' });
      await tagSelector4.click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Navigate away to glossary, then back to explore
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await waitForAllLoadersToDisappear(page);

      await sidebarClick(page, SidebarItem.EXPLORE);
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Verify the domain filter is still applied
      // Domain table should be visible
      const domainTableName = get(
        domainTable,
        'entityResponseData.displayName',
        domainTable.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(domainTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // Non-domain table should NOT be visible
      const nonDomainTableName = get(
        nonDomainTable,
        'entityResponseData.displayName',
        nonDomainTable.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(nonDomainTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${nonDomainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).not.toBeVisible();

      // Verify domain dropdown still shows the selected domain
      await expect(page.getByTestId('domain-dropdown')).toContainText(
        domain.responseData.displayName
      );
    } finally {
      await domainTable.delete(apiContext);
      await nonDomainTable.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Domain filter should work with different asset types', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const domainTable = new TableClass();
    const domainTopic = new TopicClass();
    const nonDomainTable = new TableClass();

    try {
      // Create domain and assets
      await domain.create(apiContext);
      await domainTable.create(apiContext);
      await domainTopic.create(apiContext);
      await nonDomainTable.create(apiContext);

      // Assign assets to the domain
      await domainTable.patch({
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

      await domainTopic.patch({
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

      // Navigate to explore page first (domain dropdown not visible on home page)
      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      // Select domain from navbar
      await page.getByTestId('domain-dropdown').click();
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
      });

      const searchDomainRes5 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('domain_search_index')
      );
      await page
        .getByTestId('domain-selectable-tree')
        .getByTestId('searchbar')
        .fill(domain.responseData.displayName);
      await searchDomainRes5;

      // Wait for the tag element to be visible before clicking
      const tagSelector5 = page.getByTestId(
        `tag-${domain.responseData.fullyQualifiedName}`
      );
      await tagSelector5.waitFor({ state: 'visible' });
      await tagSelector5.click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Search for domain table - should be visible
      const domainTableName = get(
        domainTable,
        'entityResponseData.displayName',
        domainTable.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(domainTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // Search for domain topic - should be visible
      const topicName = get(
        domainTopic,
        'entityResponseData.displayName',
        domainTopic.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(topicName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTopic.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // Search for non-domain table - should NOT be visible
      const nonDomainTableName = get(
        nonDomainTable,
        'entityResponseData.displayName',
        nonDomainTable.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(nonDomainTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${nonDomainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).not.toBeVisible();
    } finally {
      await domainTable.delete(apiContext);
      await domainTopic.delete(apiContext);
      await nonDomainTable.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Domain page assets tab should show only domain assets', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const domainTable = new TableClass();

    try {
      // Create domain and table
      await domain.create(apiContext);
      await domainTable.create(apiContext);

      // Assign table to domain
      await domainTable.patch({
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

      await page.reload();
      await redirectToHomePage(page);

      // Navigate to domain page
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      // Go to assets tab
      await page.getByTestId('assets').click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Verify the domain table is visible in assets
      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // Verify the asset count is 1
      await checkAssetsCount(page, 1);
    } finally {
      await domainTable.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('3-level domain hierarchy: SubSubDomain assets visible when SubDomain selected', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const domainTable = new TableClass();
    const subDomainTable = new TableClass();
    const subSubDomainTable = new TableClass();

    let subDomain: SubDomain | undefined;
    let subSubDomain: SubDomain | undefined;

    try {
      // Create 3-level domain hierarchy: Domain -> SubDomain -> SubSubDomain
      await domain.create(apiContext);
      subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);
      subSubDomain = new SubDomain(subDomain);
      await subSubDomain.create(apiContext);

      // Create tables
      await domainTable.create(apiContext);
      await subDomainTable.create(apiContext);
      await subSubDomainTable.create(apiContext);

      // Assign domainTable to parent domain
      await domainTable.patch({
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

      // Assign subDomainTable to subdomain
      await subDomainTable.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: subDomain.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      // Assign subSubDomainTable to sub-subdomain
      await subSubDomainTable.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: subSubDomain.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      // Navigate to explore page first (domain dropdown not visible on home page)
      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      // Select the SubDomain (middle level) from navbar
      await page.getByTestId('domain-dropdown').click();
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
      });

      // Search for the parent domain first to make it visible
      const searchDomainRes6 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('domain_search_index')
      );
      await page
        .getByTestId('domain-selectable-tree')
        .getByTestId('searchbar')
        .fill(domain.responseData.displayName);
      await searchDomainRes6;

      // Find the parent domain node and expand it to show subdomain
      const parentDomainNode = page
        .locator('.ant-tree-treenode')
        .filter({ hasText: domain.responseData.displayName })
        .first();

      // Click the switcher icon to expand the parent domain
      await parentDomainNode.locator('.ant-tree-switcher').click();

      // Wait for child domains to load
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Now the SubDomain should be visible, click on its tag
      const tagSelector6 = page.getByTestId(
        `tag-${subDomain.responseData.fullyQualifiedName}`
      );
      await tagSelector6.waitFor({ state: 'visible' });
      await tagSelector6.click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Search for SubDomain table - should be visible
      const subDomainTableName = get(
        subDomainTable,
        'entityResponseData.displayName',
        subDomainTable.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(subDomainTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${subDomainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // Search for SubSubDomain table - should ALSO be visible (prefix matching)
      const subSubDomainTableName = get(
        subSubDomainTable,
        'entityResponseData.displayName',
        subSubDomainTable.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(subSubDomainTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${subSubDomainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // Search for parent Domain table - should NOT be visible
      // (SubDomain is selected, not parent Domain)
      const domainTableName = get(
        domainTable,
        'entityResponseData.displayName',
        domainTable.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(domainTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).not.toBeVisible();
    } finally {
      await domainTable.delete(apiContext);
      await subDomainTable.delete(apiContext);
      await subSubDomainTable.delete(apiContext);
      if (subSubDomain) {
        await subSubDomain.delete(apiContext);
      }
      if (subDomain) {
        await subDomain.delete(apiContext);
      }
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Search suggestions should be filtered by selected domain', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const domainTable = new TableClass();
    const nonDomainTable = new TableClass();

    try {
      await domain.create(apiContext);
      await domainTable.create(apiContext);
      await nonDomainTable.create(apiContext);

      await domainTable.patch({
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

      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

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
        .fill(domain.responseData.displayName);
      await searchDomainRes;

      const tagSelector = page.getByTestId(
        `tag-${domain.responseData.fullyQualifiedName}`
      );
      await tagSelector.waitFor({ state: 'visible' });
      await tagSelector.click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      const domainTableName = get(
        domainTable,
        'entityResponseData.displayName',
        domainTable.entityResponseData.name
      );

      const suggestionSearchRes = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.request().method() === 'GET'
      );

      await page.getByTestId('searchBox').click();
      await page.getByTestId('searchBox').fill(domainTableName.substring(0, 5));

      await suggestionSearchRes;

      await page.waitForSelector('[data-testid="global-search-suggestion-box"]', {
        state: 'visible',
        timeout: 10000,
      });

      const suggestionBox = page.locator('[data-testid="global-search-suggestion-box"]');
      await expect(suggestionBox).toContainText(domainTableName);

      const nonDomainTableName = get(
        nonDomainTable,
        'entityResponseData.displayName',
        nonDomainTable.entityResponseData.name
      );

      const suggestionSearchRes2 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.request().method() === 'GET'
      );

      await page.getByTestId('searchBox').clear();
      await page.getByTestId('searchBox').fill(nonDomainTableName.substring(0, 5));

      await suggestionSearchRes2;

      await page.waitForTimeout(1000);

      const suggestionBoxAfter = page.locator('[data-testid="global-search-suggestion-box"]');
      await expect(suggestionBoxAfter).not.toContainText(nonDomainTableName);
    } finally {
      await domainTable.delete(apiContext);
      await nonDomainTable.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });
});
