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
  assignDomainToEntity,
  checkAssetsCount,
  navigateToSubDomain,
  searchAndExpectEntityNotVisible,
  searchAndExpectEntityVisible,
  selectDomain,
  selectDomainFromNavbar,
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
      await domain.create(apiContext);
      await domainTable.create(apiContext);
      await nonDomainTable.create(apiContext);

      await assignDomainToEntity(apiContext, domainTable, domain);

      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      await selectDomainFromNavbar(page, domain.responseData);

      await searchAndExpectEntityVisible(page, domainTable);
      await searchAndExpectEntityNotVisible(page, nonDomainTable);
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
      await domain.create(apiContext);
      subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);

      await parentDomainTable.create(apiContext);
      await subDomainTable.create(apiContext);

      await assignDomainToEntity(apiContext, parentDomainTable, domain);
      await assignDomainToEntity(apiContext, subDomainTable, subDomain);

      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      await selectDomainFromNavbar(page, domain.responseData);

      await searchAndExpectEntityVisible(page, parentDomainTable);
      await searchAndExpectEntityVisible(page, subDomainTable, 15000);
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
      await domain.create(apiContext);
      await domainTable.create(apiContext);
      await nonDomainTable.create(apiContext);

      await assignDomainToEntity(apiContext, domainTable, domain);

      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      await selectDomainFromNavbar(page, domain.responseData);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await waitForAllLoadersToDisappear(page);

      await sidebarClick(page, SidebarItem.EXPLORE);
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      await searchAndExpectEntityVisible(page, domainTable);
      await searchAndExpectEntityNotVisible(page, nonDomainTable);

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
      await domain.create(apiContext);
      await domainTable.create(apiContext);
      await domainTopic.create(apiContext);
      await nonDomainTable.create(apiContext);

      await assignDomainToEntity(apiContext, domainTable, domain);
      await assignDomainToEntity(apiContext, domainTopic, domain);

      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      await selectDomainFromNavbar(page, domain.responseData);

      await searchAndExpectEntityVisible(page, domainTable);
      await searchAndExpectEntityVisible(page, domainTopic);
      await searchAndExpectEntityNotVisible(page, nonDomainTable);
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
      await domain.create(apiContext);
      await domainTable.create(apiContext);

      await assignDomainToEntity(apiContext, domainTable, domain);

      await page.reload();
      await redirectToHomePage(page);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      await page.getByTestId('assets').click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator(
          `[data-testid="table-data-card_${domainTable.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

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
      await domain.create(apiContext);
      subDomain = new SubDomain(domain);
      await subDomain.create(apiContext);
      subSubDomain = new SubDomain(subDomain);
      await subSubDomain.create(apiContext);

      await domainTable.create(apiContext);
      await subDomainTable.create(apiContext);
      await subSubDomainTable.create(apiContext);

      await assignDomainToEntity(apiContext, domainTable, domain);
      await assignDomainToEntity(apiContext, subDomainTable, subDomain);
      await assignDomainToEntity(apiContext, subSubDomainTable, subSubDomain);

      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      // Select SubDomain from navbar (requires expanding parent domain tree)
      await page.getByTestId('domain-dropdown').click();
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
      });

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

      const parentDomainNode = page
        .locator('.ant-tree-treenode')
        .filter({ hasText: domain.responseData.displayName })
        .first();

      await parentDomainNode.locator('.ant-tree-switcher').click();

      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      const tagSelector6 = page.getByTestId(
        `tag-${subDomain.responseData.fullyQualifiedName}`
      );
      await tagSelector6.waitFor({ state: 'visible' });
      await tagSelector6.click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      await searchAndExpectEntityVisible(page, subDomainTable);
      await searchAndExpectEntityVisible(page, subSubDomainTable);
      await searchAndExpectEntityNotVisible(page, domainTable);
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

      await assignDomainToEntity(apiContext, domainTable, domain);

      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      await selectDomainFromNavbar(page, domain.responseData);

      const domainTableName = get(
        domainTable,
        'entityResponseData.displayName',
        domainTable.entityResponseData.name
      );

      await page.getByTestId('searchBox').click();
      await page.getByTestId('searchBox').fill(domainTableName);
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByText(domainTable.entityResponseData.fullyQualifiedName ?? '')
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
        page.getByText(nonDomainTable.entityResponseData.fullyQualifiedName ?? '', { exact: true })
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

      await assignDomainToEntity(apiContext, engineeringTable, engineeringDomain);
      await assignDomainToEntity(apiContext, engineering123Table, engineering123Domain);
      await assignDomainToEntity(apiContext, engineeringDataTable, engineeringDataSubDomain);

      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      await selectDomainFromNavbar(page, engineeringDomain.responseData);

      await searchAndExpectEntityVisible(page, engineeringTable);
      await searchAndExpectEntityVisible(page, engineeringDataTable);
      await searchAndExpectEntityNotVisible(page, engineering123Table);
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

  test('Quick filters should persist when domain filter is applied and cleared', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const domainTable1 = new TableClass();
    const domainTable2 = new TableClass();
    const nonDomainTable = new TableClass();

    try {
      await domain.create(apiContext);
      await domainTable1.create(apiContext);
      await domainTable2.create(apiContext);
      await nonDomainTable.create(apiContext);

      await assignDomainToEntity(apiContext, domainTable1, domain);
      await assignDomainToEntity(apiContext, domainTable2, domain);

      await domainTable1.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await assignTier(page, 'Tier1', domainTable1.endpoint);

      await domainTable2.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await assignTier(page, 'Tier1', domainTable2.endpoint);

      await nonDomainTable.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await assignTier(page, 'Tier1', nonDomainTable.endpoint);

      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      // Step 1: Apply Tier1 quick filter
      await page.getByTestId('search-dropdown-Tier').click();
      await waitForAllLoadersToDisappear(page);
      const tier1Option = page.getByTestId('Tier.Tier1');
      await tier1Option.waitFor({ state: 'visible' });
      await tier1Option.click();

      const quickFilterApplyRes = page.waitForResponse(
        '/api/v1/search/query?*index=dataAsset*'
      );
      await page.getByTestId('update-btn').click();
      await quickFilterApplyRes;
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      // Verify all 3 tables are visible with tier filter applied
      await searchAndExpectEntityVisible(page, domainTable1);
      await searchAndExpectEntityVisible(page, domainTable2);
      await searchAndExpectEntityVisible(page, nonDomainTable);

      // Step 2: Apply domain filter from navbar
      await selectDomainFromNavbar(page, domain.responseData);

      // Verify only 2 domain tables are visible (tier filter + domain filter)
      await searchAndExpectEntityVisible(page, domainTable1);
      await searchAndExpectEntityVisible(page, domainTable2);
      await searchAndExpectEntityNotVisible(page, nonDomainTable);

      // Step 3: Clear domain filter by selecting "All Domains"
      await page.getByTestId('domain-dropdown').click();
      await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
        state: 'visible',
      });
      await page.getByTestId('all-domains-selector').click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      await verifyActiveDomainIsDefault(page);

      // Verify all 3 tables are visible again (tier filter persists)
      await searchAndExpectEntityVisible(page, domainTable1);
      await searchAndExpectEntityVisible(page, domainTable2);
      await searchAndExpectEntityVisible(page, nonDomainTable);
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

    const domainA = new Domain();
    const domainB = new Domain();

    let subDomainA: SubDomain | undefined;

    const tableInDomainA = new TableClass();
    const tableInSubDomainA = new TableClass();
    const tableInDomainB = new TableClass();

    try {
      await domainA.create(apiContext);
      await domainB.create(apiContext);
      subDomainA = new SubDomain(domainA);
      await subDomainA.create(apiContext);

      await tableInDomainA.create(apiContext);
      await tableInSubDomainA.create(apiContext);
      await tableInDomainB.create(apiContext);

      await assignDomainToEntity(apiContext, tableInDomainA, domainA);
      await assignDomainToEntity(apiContext, tableInSubDomainA, subDomainA);
      await assignDomainToEntity(apiContext, tableInDomainB, domainB);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domainA.data);

      await page.getByTestId('assets').click();
      await waitForAllLoadersToDisappear(page);
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator(
          `[data-testid="table-data-card_${tableInDomainA.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      await expect(
        page.locator(
          `[data-testid="table-data-card_${tableInSubDomainA.entityResponseData.fullyQualifiedName}"]`
        )
      ).toBeVisible();

      await expect(
        page.locator(
          `[data-testid="table-data-card_${tableInDomainB.entityResponseData.fullyQualifiedName}"]`
        )
      ).not.toBeVisible();

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

      dataProductInSubDomainA = new DataProduct([], undefined, [subDomainA]);
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

      // === SETUP: Create domain hierarchy ===
      await rootDomain.create(apiContext);

      subDomain1 = new SubDomain(rootDomain);
      await subDomain1.create(apiContext);

      subDomain2 = new SubDomain(rootDomain);
      await subDomain2.create(apiContext);

      subSubDomain = new SubDomain(subDomain1);
      await subSubDomain.create(apiContext);

      await rootTable.create(apiContext);
      await subDomain1Table1.create(apiContext);
      await subDomain1Table2.create(apiContext);
      await subSubDomainTable1.create(apiContext);
      await subSubDomainTable2.create(apiContext);
      await subDomain2Table.create(apiContext);

      // === SETUP: Assign tables to domains ===
      await assignDomainToEntity(apiContext, rootTable, rootDomain);
      await assignDomainToEntity(apiContext, subDomain1Table1, subDomain1);
      await assignDomainToEntity(apiContext, subDomain1Table2, subDomain1);
      await assignDomainToEntity(apiContext, subSubDomainTable1, subSubDomain);
      await assignDomainToEntity(apiContext, subSubDomainTable2, subSubDomain);
      await assignDomainToEntity(apiContext, subDomain2Table, subDomain2);

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

  });
});
