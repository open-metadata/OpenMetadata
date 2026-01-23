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
import { DataProduct } from '../../support/domain/DataProduct';
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
  navigateToSubDomain,
  selectDomain,
  verifyActiveDomainIsDefault,
} from '../../utils/domain';
import { assignTier, waitForAllLoadersToDisappear } from '../../utils/entity';
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

      await page.getByTestId('searchBox').click();

      await page.getByTestId('searchBox').fill(domainTableName);
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByText(domainTable.entityResponseData.fullyQualifiedName)
      ).toBeVisible();

      const nonDomainTableName = get(
        nonDomainTable,
        'entityResponseData.displayName',
        nonDomainTable.entityResponseData.name
      );

      await page.getByTestId('searchBox').clear();

      await page.getByTestId('searchBox').fill(nonDomainTableName);
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByText(nonDomainTable.entityResponseData.fullyQualifiedName)
      ).not.toBeVisible();
    } finally {
      await domainTable.delete(apiContext);
      await nonDomainTable.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Domain filter should use exact match and prefix with dot to prevent false positives', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);

    const engineeringDomain = new Domain();
    const engineering123Domain = new Domain();

    const engineeringTable = new TableClass();
    const engineering123Table = new TableClass();
    const engineeringDataTable = new TableClass();

    let engineeringDataSubDomain: SubDomain | undefined;

    try {
      await engineeringDomain.create(apiContext);
      await engineering123Domain.create(apiContext);

      engineeringDataSubDomain = new SubDomain(engineeringDomain);
      await engineeringDataSubDomain.create(apiContext);

      await engineeringTable.create(apiContext);
      await engineering123Table.create(apiContext);
      await engineeringDataTable.create(apiContext);

      await engineeringTable.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: engineeringDomain.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      await engineering123Table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: engineering123Domain.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      await engineeringDataTable.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: engineeringDataSubDomain.responseData.id,
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
        .fill(engineeringDomain.responseData.displayName);
      await searchDomainRes;

      const tagSelector = page.getByTestId(
        `tag-${engineeringDomain.responseData.fullyQualifiedName}`
      );
      await tagSelector.waitFor({ state: 'visible' });
      await tagSelector.click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      const engineeringTableName = get(
        engineeringTable,
        'entityResponseData.displayName',
        engineeringTable.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(engineeringTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${engineeringTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      const engineeringDataTableName = get(
        engineeringDataTable,
        'entityResponseData.displayName',
        engineeringDataTable.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(engineeringDataTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${engineeringDataTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      const engineering123TableName = get(
        engineering123Table,
        'entityResponseData.displayName',
        engineering123Table.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(engineering123TableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${engineering123Table.entityResponseData.fullyQualifiedName}"]`
        )
      ).not.toBeVisible();
    } finally {
      await engineeringTable.delete(apiContext);
      await engineering123Table.delete(apiContext);
      await engineeringDataTable.delete(apiContext);
      if (engineeringDataSubDomain) {
        await engineeringDataSubDomain.delete(apiContext);
      }
      await engineeringDomain.delete(apiContext);
      await engineering123Domain.delete(apiContext);
      await afterAction();
    }
  });

  test.skip('Quick filters should persist when domain filter is applied and cleared', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const domainTable1 = new TableClass();
    const domainTable2 = new TableClass();
    const nonDomainTable = new TableClass();

    try {
      // Setup: Create 1 domain and 3 tables
      await domain.create(apiContext);
      await domainTable1.create(apiContext);
      await domainTable2.create(apiContext);
      await nonDomainTable.create(apiContext);

      // Assign 2 tables to the domain
      await domainTable1.patch({
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

      await domainTable2.patch({
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

      // Assign Tier1 to all 3 tables
      await domainTable1.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await assignTier(page, 'Tier1', domainTable1.endpoint);

      await domainTable2.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await assignTier(page, 'Tier1', domainTable2.endpoint);

      await nonDomainTable.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await assignTier(page, 'Tier1', nonDomainTable.endpoint);

      // Navigate to explore page
      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      // Step 1: Apply Tier1 quick filter
      await page.getByTestId('search-dropdown-Tier').click();
      await waitForAllLoadersToDisappear(page);
      const tier1Option = page.getByTestId('Tier.Tier1');
      await tier1Option.waitFor({ state: 'visible'});
      await tier1Option.click();

      const quickFilterApplyRes = page.waitForResponse(
        '/api/v1/search/query?*index=dataAsset*'
      );
      await page.getByTestId('update-btn').click();
      await quickFilterApplyRes;
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Verify all 3 tables are visible with tier filter applied
      const domainTable1Name = get(
        domainTable1,
        'entityResponseData.displayName',
        domainTable1.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(domainTable1Name);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTable1.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      const domainTable2Name = get(
        domainTable2,
        'entityResponseData.displayName',
        domainTable2.entityResponseData.name
      );
      await page.getByTestId('searchBox').fill(domainTable2Name);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTable2.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

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
      ).toBeVisible();

      // Step 2: Apply domain filter from navbar
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

      // Verify only 2 domain tables are visible (tier filter + domain filter)
      await page.getByTestId('searchBox').fill(domainTable1Name);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTable1.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      await page.getByTestId('searchBox').fill(domainTable2Name);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTable2.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // Non-domain table should NOT be visible
      await page.getByTestId('searchBox').fill(nonDomainTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${nonDomainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).not.toBeVisible();

      // Step 3: Clear domain filter by selecting "All Domains"
      await page.getByTestId('domain-dropdown').click();
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
      });
      await page.getByTestId('all-domains-selector').click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Verify domain is cleared
      await verifyActiveDomainIsDefault(page);

      // Verify all 3 tables are visible again (tier filter persists)
      await page.getByTestId('searchBox').fill(domainTable1Name);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTable1.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      await page.getByTestId('searchBox').fill(domainTable2Name);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTable2.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      await page.getByTestId('searchBox').fill(nonDomainTableName);
      await page.getByTestId('searchBox').press('Enter');
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(
          `[data-testid="table-data-card_${nonDomainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();
    } finally {
      await domainTable1.delete(apiContext);
      await domainTable2.delete(apiContext);
      await nonDomainTable.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Domain assets tab should NOT show assets from other domains', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);

    // Create two separate domains where domainA has a subdomain
    const domainA = new Domain();
    const domainB = new Domain();

    let subDomainA: SubDomain | undefined;

    // Create one table for each domain/subdomain
    const tableInDomainA = new TableClass();
    const tableInSubDomainA = new TableClass();
    const tableInDomainB = new TableClass();

    try {
      // Setup: Create both domains, subdomain, and tables
      await domainA.create(apiContext);
      await domainB.create(apiContext);
      subDomainA = new SubDomain(domainA);
      await subDomainA.create(apiContext);

      await tableInDomainA.create(apiContext);
      await tableInSubDomainA.create(apiContext);
      await tableInDomainB.create(apiContext);

      // Assign tableInDomainA to domainA
      await tableInDomainA.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: domainA.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      // Assign tableInSubDomainA to subDomainA
      await tableInSubDomainA.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: subDomainA.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      // Assign tableInDomainB to domainB
      await tableInDomainB.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: domainB.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      // Navigate to domainA's page
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domainA.data);

      // Go to Assets tab
      await page.getByTestId('assets').click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Verify domainA's table IS visible
      await expect(
        page.locator(
          `[data-testid="table-data-card_${tableInDomainA.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // Verify subDomainA's table IS visible (subdomain assets should be included)
      await expect(
        page.locator(
          `[data-testid="table-data-card_${tableInSubDomainA.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      // Verify domainB's table is NOT visible (this is the bug - it should NOT appear)
      await expect(
        page.locator(
          `[data-testid="table-data-card_${tableInDomainB.entityResponseData.fullyQualifiedName}"]`
        )
      ).not.toBeVisible();

      // Verify asset count is exactly 2 (domainA + subDomainA assets)
      await checkAssetsCount(page, 2);
    } finally {
      await tableInDomainA.delete(apiContext);
      await tableInSubDomainA.delete(apiContext);
      await tableInDomainB.delete(apiContext);
      if (subDomainA) {
        await subDomainA.delete(apiContext);
      }
      await domainA.delete(apiContext);
      await domainB.delete(apiContext);
      await afterAction();
    }
  });

  test('Domain Data Products tab should NOT show data products from other domains', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);

    // Create two separate domains
    const domainA = new Domain();
    const domainB = new Domain();

    let subDomainA: SubDomain | undefined;
    let dataProductInDomainA: DataProduct | undefined;
    let dataProductInSubDomainA: DataProduct | undefined;
    let dataProductInDomainB: DataProduct | undefined;

    try {
      // Setup: Create both domains and subdomain
      await domainA.create(apiContext);
      await domainB.create(apiContext);
      subDomainA = new SubDomain(domainA);
      await subDomainA.create(apiContext);

      // Create data products for each domain
      dataProductInDomainA = new DataProduct([domainA]);
      await dataProductInDomainA.create(apiContext);

      dataProductInSubDomainA = new DataProduct([subDomainA]);
      await dataProductInSubDomainA.create(apiContext);

      dataProductInDomainB = new DataProduct([domainB]);
      await dataProductInDomainB.create(apiContext);

      // Navigate to domainA's page
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domainA.data);

      // Go to Data Products tab
      await page.getByTestId('data_products').click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Verify the Data Products count is 2 (domainA + subDomainA)
      const dataProductsCount = await page
        .getByTestId('data_products')
        .getByTestId('count')
        .textContent();
      expect(dataProductsCount).toBe('2');

      // Verify domainA's data product IS visible (use first link to avoid summary panel duplicate)
      await expect(
        page
          .getByRole('link', {
            name: dataProductInDomainA.data.displayName,
            exact: true,
          })
          .first()
      ).toBeVisible();

      // Verify subDomainA's data product IS visible (subdomain data products should be included)
      await expect(
        page
          .getByRole('link', {
            name: dataProductInSubDomainA.data.displayName,
            exact: true,
          })
          .first()
      ).toBeVisible();

      // Verify domainB's data product is NOT visible
      await expect(
        page.getByRole('link', {
          name: dataProductInDomainB.data.displayName,
          exact: true,
        })
      ).not.toBeVisible();
    } finally {
      if (dataProductInDomainA) {
        await dataProductInDomainA.delete(apiContext);
      }
      if (dataProductInSubDomainA) {
        await dataProductInSubDomainA.delete(apiContext);
      }
      if (dataProductInDomainB) {
        await dataProductInDomainB.delete(apiContext);
      }
      if (subDomainA) {
        await subDomainA.delete(apiContext);
      }
      await domainA.delete(apiContext);
      await domainB.delete(apiContext);
      await afterAction();
    }
  });

  test('Multi-nested domain hierarchy: filters should scope correctly at every level', async ({
    page,
  }) => {
    /**
     * Domain Hierarchy:
     * RootDomain
     * ├── SubDomain1
     * │   └── SubSubDomain
     * └── SubDomain2 (sibling)
     *
     * Tables:
     * - rootTable: RootDomain, Tier1
     * - subDomain1Table1: SubDomain1, Tier5
     * - subDomain1Table2: SubDomain1, PersonalData.Personal
     * - subSubDomainTable1: SubSubDomain, Tier5 + PII.Sensitive
     * - subSubDomainTable2: SubSubDomain, PersonalData.Personal
     * - subDomain2Table: SubDomain2, Tier5 (sibling domain)
     */
    const { afterAction, apiContext } = await getApiContext(page);

    const rootDomain = new Domain();
    const rootTable = new TableClass();
    const subDomain1Table1 = new TableClass();
    const subDomain1Table2 = new TableClass();
    const subSubDomainTable1 = new TableClass();
    const subSubDomainTable2 = new TableClass();
    const subDomain2Table = new TableClass();

    let subDomain1: SubDomain | undefined;
    let subDomain2: SubDomain | undefined;
    let subSubDomain: SubDomain | undefined;

    // Helper to verify asset visibility
    const expectVisible = async (fqn: string | undefined) => {
      await expect(
        page.locator(`a[href*="${fqn}"]`).first()
      ).toBeVisible();
    };

    const expectNotVisible = async (fqn: string | undefined) => {
      await expect(
        page.locator(`a[href*="${fqn}"]`).first()
      ).not.toBeVisible();
    };

    // Helper to apply Tier filter
    const applyTierFilter = async (tier: string) => {
      await page.locator('.filters-row button').first().click();
      await page.getByRole('menuitem', { name: /Tier/i }).click();
      await page.click('[data-testid="search-dropdown-Tier"]');
      await page.waitForSelector('[data-testid="drop-down-menu"]', {
        state: 'visible',
      });
      const checkbox = page.getByTestId(`${tier}-checkbox`);
      await checkbox.waitFor({ state: 'visible' });
      await checkbox.click();
      const filterRes = page.waitForResponse('/api/v1/search/query?*index=all*');
      await page.click('[data-testid="update-btn"]');
      await filterRes;
      await waitForAllLoadersToDisappear(page);
    };

    // Helper to apply Tag filter
    const applyTagFilter = async (searchTerm: string, tagPattern: RegExp) => {
      await page.locator('.filters-row button').first().click();
      await page.getByRole('menuitem', { name: /Tag/i }).click();
      await page.click('[data-testid="search-dropdown-Tag"]');
      await page.waitForSelector('[data-testid="drop-down-menu"]', {
        state: 'visible',
      });
      await page
        .getByTestId('drop-down-menu')
        .getByTestId('search-input')
        .fill(searchTerm);
      await page.waitForLoadState('networkidle');
      await page.getByRole('menuitem', { name: tagPattern }).click();
      const filterRes = page.waitForResponse('/api/v1/search/query?*index=all*');
      await page.click('[data-testid="update-btn"]');
      await filterRes;
      await waitForAllLoadersToDisappear(page);
    };

    // Helper to apply Entity Type filter
    const applyEntityTypeFilter = async (entityType: string) => {
      await page.locator('.filters-row button').first().click();
      await page.getByRole('menuitem', { name: /Entity Type/i }).click();
      await page.click('[data-testid="search-dropdown-Entity Type"]');
      await page.waitForSelector('[data-testid="drop-down-menu"]', {
        state: 'visible',
      });
      const checkbox = page.getByTestId(`${entityType}-checkbox`);
      await checkbox.waitFor({ state: 'visible' });
      await checkbox.click();
      const filterRes = page.waitForResponse('/api/v1/search/query?*index=all*');
      await page.click('[data-testid="update-btn"]');
      await filterRes;
      await waitForAllLoadersToDisappear(page);
    };

    // Helper to clear filters
    const clearFilters = async () => {
      await page.locator('.text-primary').filter({ hasText: /Clear/i }).click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
    };

    // Helper to navigate to a subdomain's assets tab
    const goToSubDomainAssets = async (subDomainData: { displayName: string; name: string }) => {
      await page.getByTestId('subdomains').click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId(subDomainData.name).click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('assets').click();
      await waitForAllLoadersToDisappear(page);
    };

    try {
      // === SETUP: Create domain hierarchy ===
      await rootDomain.create(apiContext);

      subDomain1 = new SubDomain(rootDomain);
      await subDomain1.create(apiContext);

      subDomain2 = new SubDomain(rootDomain);
      await subDomain2.create(apiContext);

      subSubDomain = new SubDomain(subDomain1);
      await subSubDomain.create(apiContext);

      // Create all tables
      await rootTable.create(apiContext);
      await subDomain1Table1.create(apiContext);
      await subDomain1Table2.create(apiContext);
      await subSubDomainTable1.create(apiContext);
      await subSubDomainTable2.create(apiContext);
      await subDomain2Table.create(apiContext);

      // === SETUP: Assign tables to domains ===
      // rootTable -> RootDomain
      await rootTable.patch({
        apiContext,
        patchData: [
          { op: 'add', path: '/domains/0', value: { id: rootDomain.responseData.id, type: 'domain' } },
        ],
      });

      // subDomain1Table1 -> SubDomain1
      await subDomain1Table1.patch({
        apiContext,
        patchData: [
          { op: 'add', path: '/domains/0', value: { id: subDomain1.responseData.id, type: 'domain' } },
        ],
      });

      // subDomain1Table2 -> SubDomain1
      await subDomain1Table2.patch({
        apiContext,
        patchData: [
          { op: 'add', path: '/domains/0', value: { id: subDomain1.responseData.id, type: 'domain' } },
        ],
      });

      // subSubDomainTable1 -> SubSubDomain
      await subSubDomainTable1.patch({
        apiContext,
        patchData: [
          { op: 'add', path: '/domains/0', value: { id: subSubDomain.responseData.id, type: 'domain' } },
        ],
      });

      // subSubDomainTable2 -> SubSubDomain
      await subSubDomainTable2.patch({
        apiContext,
        patchData: [
          { op: 'add', path: '/domains/0', value: { id: subSubDomain.responseData.id, type: 'domain' } },
        ],
      });

      // subDomain2Table -> SubDomain2 (sibling)
      await subDomain2Table.patch({
        apiContext,
        patchData: [
          { op: 'add', path: '/domains/0', value: { id: subDomain2.responseData.id, type: 'domain' } },
        ],
      });

      // === SETUP: Assign tags ===
      // rootTable: Tier1
      await rootTable.patch({
        apiContext,
        patchData: [
          { op: 'add', path: '/tags/0', value: { tagFQN: 'Tier.Tier1', source: 'Classification', labelType: 'Manual' } },
        ],
      });

      // subDomain1Table1: Tier5
      await subDomain1Table1.patch({
        apiContext,
        patchData: [
          { op: 'add', path: '/tags/0', value: { tagFQN: 'Tier.Tier5', source: 'Classification', labelType: 'Manual' } },
        ],
      });

      // subDomain1Table2: PersonalData.Personal
      await subDomain1Table2.patch({
        apiContext,
        patchData: [
          { op: 'add', path: '/tags/0', value: { tagFQN: 'PersonalData.Personal', source: 'Classification', labelType: 'Manual' } },
        ],
      });

      // subSubDomainTable1: Tier5 + PII.Sensitive
      await subSubDomainTable1.patch({
        apiContext,
        patchData: [
          { op: 'add', path: '/tags/0', value: { tagFQN: 'Tier.Tier5', source: 'Classification', labelType: 'Manual' } },
          { op: 'add', path: '/tags/1', value: { tagFQN: 'PII.Sensitive', source: 'Classification', labelType: 'Manual' } },
        ],
      });

      // subSubDomainTable2: PersonalData.Personal
      await subSubDomainTable2.patch({
        apiContext,
        patchData: [
          { op: 'add', path: '/tags/0', value: { tagFQN: 'PersonalData.Personal', source: 'Classification', labelType: 'Manual' } },
        ],
      });

      // subDomain2Table: Tier5
      await subDomain2Table.patch({
        apiContext,
        patchData: [
          { op: 'add', path: '/tags/0', value: { tagFQN: 'Tier.Tier5', source: 'Classification', labelType: 'Manual' } },
        ],
      });

      // === NAVIGATE TO DOMAIN PAGE ===
      await sidebarClick(page, SidebarItem.DOMAIN);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      await selectDomain(page, rootDomain.responseData);

      // ==========================================
      // TEST LEVEL 1: SubDomain1 Assets
      // Should see: subDomain1Table1, subDomain1Table2, subSubDomainTable1, subSubDomainTable2
      // Should NOT see: rootTable, subDomain2Table
      // ==========================================
      await navigateToSubDomain(page, subDomain1.data);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('assets').click();
      await waitForAllLoadersToDisappear(page);

      // Verify initial scoping at SubDomain1
      await expectVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectVisible(subDomain1Table2.entityResponseData?.fullyQualifiedName);
      await expectVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);

      // --- SubDomain1: Tier5 Filter ---
      await applyTierFilter('Tier.Tier5');
      await expectVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);
      await clearFilters();

      // --- SubDomain1: PersonalData Filter ---
      await applyTagFilter('PersonalData', /personaldata\.personal/i);
      await expectVisible(subDomain1Table2.entityResponseData?.fullyQualifiedName);
      await expectVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);
      await clearFilters();

      // --- SubDomain1: PII.Sensitive Filter (only subSubDomainTable1 has this) ---
      await applyTagFilter('PII', /pii\.sensitive/i);
      await expectVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);
      await clearFilters();

      // --- SubDomain1: Entity Type Filter ---
      await applyEntityTypeFilter('table');
      await expectVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectVisible(subDomain1Table2.entityResponseData?.fullyQualifiedName);
      await expectVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);
      await clearFilters();

      // ==========================================
      // TEST LEVEL 2: SubSubDomain Assets
      // Should see: subSubDomainTable1, subSubDomainTable2 only
      // Should NOT see: rootTable, subDomain1Table1, subDomain1Table2, subDomain2Table
      // ==========================================
      await goToSubDomainAssets(subSubDomain.data);

      // Verify initial scoping at SubSubDomain
      await expectVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);

      // --- SubSubDomain: Tier5 Filter ---
      await applyTierFilter('Tier.Tier5');
      await expectVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);
      await clearFilters();

      // --- SubSubDomain: PersonalData Filter ---
      await applyTagFilter('PersonalData', /personaldata\.personal/i);
      await expectVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);
      await clearFilters();

      // --- SubSubDomain: PII.Sensitive Filter ---
      await applyTagFilter('PII', /pii\.sensitive/i);
      await expectVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await clearFilters();

      // --- SubSubDomain: Entity Type Filter ---
      await applyEntityTypeFilter('table');
      await expectVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);
      await clearFilters();

      // ==========================================
      // TEST LEVEL 3: SubDomain2 Assets (sibling isolation test)
      // Should see: subDomain2Table only
      // Should NOT see: anything from SubDomain1 tree or RootDomain
      // ==========================================
      await sidebarClick(page, SidebarItem.DOMAIN);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      await selectDomain(page, rootDomain.responseData);
      await navigateToSubDomain(page, subDomain2.data);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('assets').click();
      await waitForAllLoadersToDisappear(page);

      // Verify initial scoping at SubDomain2
      await expectVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);

      // --- SubDomain2: Tier5 Filter ---
      await applyTierFilter('Tier.Tier5');
      await expectVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await clearFilters();

      // --- SubDomain2: Entity Type Filter ---
      await applyEntityTypeFilter('table');
      await expectVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await clearFilters();

      // ==========================================
      // TEST LEVEL 4: RootDomain Assets (parent level)
      // Should see: ALL tables (root + all children)
      // ==========================================
      await sidebarClick(page, SidebarItem.DOMAIN);
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      await selectDomain(page, rootDomain.responseData);
      await page.getByTestId('assets').click();
      await waitForAllLoadersToDisappear(page);

      // At root level, all tables should be visible
      await expectVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await expectVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectVisible(subDomain1Table2.entityResponseData?.fullyQualifiedName);
      await expectVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await expectVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);

      // --- RootDomain: Tier1 Filter (only rootTable has Tier1) ---
      await applyTierFilter('Tier.Tier1');
      await expectVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await clearFilters();

      // --- RootDomain: Tier5 Filter (multiple tables have Tier5) ---
      await applyTierFilter('Tier.Tier5');
      await expectNotVisible(rootTable.entityResponseData?.fullyQualifiedName);
      await expectVisible(subDomain1Table1.entityResponseData?.fullyQualifiedName);
      await expectVisible(subSubDomainTable1.entityResponseData?.fullyQualifiedName);
      await expectVisible(subDomain2Table.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subDomain1Table2.entityResponseData?.fullyQualifiedName);
      await expectNotVisible(subSubDomainTable2.entityResponseData?.fullyQualifiedName);
      await clearFilters();

    } finally {
      // Cleanup in reverse order of dependencies
      await rootTable.delete(apiContext);
      await subDomain1Table1.delete(apiContext);
      await subDomain1Table2.delete(apiContext);
      await subSubDomainTable1.delete(apiContext);
      await subSubDomainTable2.delete(apiContext);
      await subDomain2Table.delete(apiContext);
      if (subSubDomain) {
        await subSubDomain.delete(apiContext);
      }
      if (subDomain1) {
        await subDomain1.delete(apiContext);
      }
      if (subDomain2) {
        await subDomain2.delete(apiContext);
      }
      await rootDomain.delete(apiContext);
      await afterAction();
    }
  });
});
