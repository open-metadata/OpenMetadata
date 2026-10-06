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
import { Query } from '../../../src/generated/entity/data/query';
import {
  ACTION_TIMEOUT,
  API_FIXTURE_TEST_TIMEOUT,
} from '../../constant/common';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { SubDomain } from '../../support/domain/SubDomain';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { performAdminLogin } from '../../utils/admin';
import { okJson } from '../../utils/apiResponse';
import {
  getApiContext,
  redirectToExplorePage,
  redirectToHomePage,
} from '../../utils/common';
import {
  assignDomainToEntity,
  checkAssetsCount,
  domainQueryFilter,
  navigateToSubDomain,
  searchAndExpectEntityNotVisible,
  searchAndExpectEntityVisible,
  selectDomain,
  selectDomainFromNavbar,
  verifyActiveDomainIsDefault,
} from '../../utils/domain';
import { assignTier, waitForAllLoadersToDisappear } from '../../utils/entity';
import { clickUpdateButtonIfVisible } from '../../utils/explore';
import { waitForSearchIndexed } from '../../utils/polling';
import { waitForAggregation } from '../../utils/searchAggregation';
import { sidebarClick } from '../../utils/sidebar';

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const { page, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    await use(page);
    await afterAction();
  },
});

const getDomainMustClauses = (queryFilter: string): unknown[] => {
  try {
    return get(JSON.parse(queryFilter), 'query.bool.must', []);
  } catch {
    return [];
  }
};

const expectQueryVisibleForDomain = async (
  page: Page,
  domain: Domain,
  queryText: string
) => {
  const queryResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    const queryFilter = url.searchParams.get('query_filter') ?? '';

    if (
      !url.pathname.endsWith('/api/v1/search/query') ||
      url.searchParams.get('index')?.includes('query') !== true
    ) {
      return false;
    }

    const mustClauses = getDomainMustClauses(queryFilter);
    const domainFqn = domain.responseData.fullyQualifiedName;

    return mustClauses.some((mustClause) =>
      get(mustClause, 'bool.should', []).some(
        (domainClause: unknown) =>
          get(domainClause, ['term', 'domains.fullyQualifiedName']) ===
            domainFqn ||
          get(domainClause, ['prefix', 'domains.fullyQualifiedName']) ===
            `${domainFqn}.`
      )
    );
  });
  await selectDomainFromNavbar(page, domain.responseData);
  const queriesTab = page.getByTestId('table_queries');

  await expect(queriesTab).toBeEnabled();
  await queriesTab.click();
  expect((await queryResponse).status()).toBe(200);
  await waitForAllLoadersToDisappear(page);
  await expect(
    page.getByTestId('query-card').filter({ hasText: queryText })
  ).toBeVisible();
};

test.describe('Domain Filter - User Behavior Tests', () => {
  // API fixture build needs more than the 60s default.
  test.describe.configure({ timeout: API_FIXTURE_TEST_TIMEOUT });

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

  test('Queries should inherit every associated table domain', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const firstDomain = new Domain();
    const secondDomain = new Domain();
    const firstTable = new TableClass();
    const secondTable = new TableClass();
    const queryText = `select query_domain_inheritance_${Date.now()}`;
    let queryId: string | undefined;

    try {
      await firstDomain.create(apiContext);
      await secondDomain.create(apiContext);
      await firstTable.create(apiContext);
      await secondTable.create(apiContext);
      await assignDomainToEntity(apiContext, firstTable, firstDomain);
      await assignDomainToEntity(apiContext, secondTable, secondDomain);

      const response = await apiContext.post('/api/v1/queries', {
        data: {
          query: queryText,
          queryUsedIn: [
            { id: firstTable.entityResponseData.id, type: 'table' },
            { id: secondTable.entityResponseData.id, type: 'table' },
          ],
          queryDate: Date.now(),
          service: firstTable.serviceResponseData.name,
        },
      });
      const query = await okJson<Query>(response, 'create multi-table query');
      queryId = query.id;

      // Wait for both inherited domains to land on the query document.
      for (const domain of [firstDomain, secondDomain]) {
        await waitForSearchIndexed(
          apiContext,
          query.fullyQualifiedName,
          'query_search_index',
          {
            queryFilter: domainQueryFilter(
              domain.responseData.fullyQualifiedName ?? ''
            ),
          }
        );
      }

      // The same query must remain discoverable under both inherited domains,
      // including when the selected domain came from its other associated table.
      await firstTable.visitEntityPage(page);
      await expectQueryVisibleForDomain(page, firstDomain, queryText);
      await expectQueryVisibleForDomain(page, secondDomain, queryText);
    } finally {
      if (queryId) {
        await apiContext.delete(
          `/api/v1/queries/${queryId}?recursive=true&hardDelete=true`
        );
      }
      await firstTable.delete(apiContext);
      await secondTable.delete(apiContext);
      await firstDomain.delete(apiContext);
      await secondDomain.delete(apiContext);
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

      await page.reload({ waitUntil: 'domcontentloaded' });
      await redirectToHomePage(page);

      await sidebarClick(page, SidebarItem.DOMAIN);
      await selectDomain(page, domain.data);

      await page.getByTestId('assets').click();
      await waitForAllLoadersToDisappear(page);

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

      // Domain search returns sub-domains; no tree expansion needed.
      await selectDomainFromNavbar(page, subDomain.responseData);

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
        page
          .getByTestId('group-table')
          .getByTestId('data-name')
          .filter({
            hasText: domainTable.entityResponseData.fullyQualifiedName ?? '',
          })
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
        page.getByText(
          nonDomainTable.entityResponseData.fullyQualifiedName ?? '',
          { exact: true }
        )
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

      await assignDomainToEntity(
        apiContext,
        engineeringTable,
        engineeringDomain
      );
      await assignDomainToEntity(
        apiContext,
        engineering123Table,
        engineering123Domain
      );
      await assignDomainToEntity(
        apiContext,
        engineeringDataTable,
        engineeringDataSubDomain
      );

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
      await assignTier(page, 'Tier1', domainTable1.endpoint);

      await domainTable2.visitEntityPage(page);
      await assignTier(page, 'Tier1', domainTable2.endpoint);

      await nonDomainTable.visitEntityPage(page);
      await assignTier(page, 'Tier1', nonDomainTable.endpoint);

      await redirectToExplorePage(page);
      await waitForAllLoadersToDisappear(page);

      // Step 1: Apply Tier1 quick filter
      await page.getByTestId('search-dropdown-Tier').click();
      await waitForAllLoadersToDisappear(page);
      const tier1Option = page.getByTestId('tier.tier1');
      await tier1Option.waitFor({ state: 'visible' });

      // Arm before selecting: immediate-apply fires the query on the click
      const quickFilterApplyRes = page.waitForResponse(
        '/api/v1/search/query?*index=dataAsset*'
      );
      await tier1Option.click();
      await clickUpdateButtonIfVisible(page);
      await quickFilterApplyRes;
      await waitForAllLoadersToDisappear(page);

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
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('domain-dropdown').click();
      await page.getByTestId('domain-dropdown-search').waitFor({
        state: 'visible',
      });
      await page.getByTestId('tree-node-All Domains').click();
      await waitForAllLoadersToDisappear(page);

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

      // Verify the Data Products count is 2 (domainA + subDomainA)
      await expect(
        page.getByTestId('data_products').getByTestId('count')
      ).toHaveText('2');

      // Verify domainA's data product IS visible (use first link to avoid summary panel duplicate)
      await expect(
        page
          .getByRole('link', {
            name: dataProductInDomainA.data.displayName,
            exact: true,
          })
          .filter({ visible: true })
      ).not.toHaveCount(0);

      // Verify subDomainA's data product IS visible (subdomain data products should be included)
      await expect(
        page
          .getByRole('link', {
            name: dataProductInSubDomainA.data.displayName,
            exact: true,
          })
          .filter({ visible: true })
      ).not.toHaveCount(0);

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
});

/**
 * Domain Hierarchy:
 * RootDomain
 * ├── SubDomain1
 * │   └── SubSubDomain
 * └── SubDomain2 (sibling)
 */
type HierarchySubDomain = 'subDomain1' | 'subSubDomain' | 'subDomain2';

type HierarchyTable =
  | 'rootTable'
  | 'subDomain1Table1'
  | 'subDomain1Table2'
  | 'subSubDomainTable1'
  | 'subSubDomainTable2'
  | 'subDomain2Table';

const HIERARCHY_TABLES: Record<
  HierarchyTable,
  { domain: HierarchySubDomain | 'rootDomain'; tags: string[] }
> = {
  rootTable: { domain: 'rootDomain', tags: ['Tier.Tier1'] },
  subDomain1Table1: { domain: 'subDomain1', tags: ['Tier.Tier5'] },
  subDomain1Table2: { domain: 'subDomain1', tags: ['PersonalData.Personal'] },
  subSubDomainTable1: {
    domain: 'subSubDomain',
    tags: ['Tier.Tier5', 'PII.Sensitive'],
  },
  subSubDomainTable2: {
    domain: 'subSubDomain',
    tags: ['PersonalData.Personal'],
  },
  subDomain2Table: { domain: 'subDomain2', tags: ['Tier.Tier5'] },
};

const HIERARCHY_TABLE_KEYS = Object.keys(HIERARCHY_TABLES) as HierarchyTable[];

// The open dropdown is capped at 10 buckets ordered by key, so a crowded facet hides the option; typing re-queries for it.
const searchInDropdown = async (page: Page, searchText: string) => {
  const aggregation = waitForAggregation(page, { value: searchText });
  await page
    .getByTestId('drop-down-menu')
    .getByTestId('search-input')
    .fill(searchText);
  await aggregation;
};

/** Opens the assets-tab filter menu. Clicks are bounded so a missed locator fails instead of hanging. */
const openAssetFilterMenu = async (page: Page, menuItem: RegExp) => {
  await page
    .locator('.filters-row')
    .getByTestId('asset-filter-button')
    .click({ timeout: ACTION_TIMEOUT });
  await page
    .getByRole('menuitem', { name: menuItem })
    .click({ timeout: ACTION_TIMEOUT });
};

const applyCheckboxFilter = async (
  page: Page,
  menuItem: RegExp,
  dropdownTestId: string,
  option: string
) => {
  await openAssetFilterMenu(page, menuItem);
  await page.click(`[data-testid="${dropdownTestId}"]`);
  await page.getByTestId('drop-down-menu').waitFor({ state: 'visible' });
  const checkbox = page.getByTestId('drop-down-menu').getByTestId(option);
  await searchInDropdown(page, option);
  await checkbox.waitFor({ state: 'visible' });
  await checkbox.click();
  const filterRes = page.waitForResponse('/api/v1/search/query?*index=all*');
  await page.click('[data-testid="update-btn"]', {
    timeout: ACTION_TIMEOUT,
  });
  await filterRes;
  await waitForAllLoadersToDisappear(page);
};

const applyTagFilter = async (
  page: Page,
  searchTerm: string,
  tagPattern: RegExp
) => {
  await openAssetFilterMenu(page, /Tag/i);
  await page.click('[data-testid="search-dropdown-Tag"]');
  await page.getByTestId('drop-down-menu').waitFor({ state: 'visible' });
  await page
    .getByTestId('drop-down-menu')
    .getByTestId('search-input')
    .fill(searchTerm);
  await page.getByRole('menuitemcheckbox', { name: tagPattern }).click();
  const filterRes = page.waitForResponse('/api/v1/search/query?*index=all*');
  await page.click('[data-testid="update-btn"]', {
    timeout: ACTION_TIMEOUT,
  });
  await filterRes;
  await waitForAllLoadersToDisappear(page);
};

type HierarchyFilter = { name: string; apply: (page: Page) => Promise<void> };

const TIER1_FILTER: HierarchyFilter = {
  name: 'Tier1',
  apply: (page) =>
    applyCheckboxFilter(page, /Tier/i, 'search-dropdown-Tier', 'tier.tier1'),
};
const TIER5_FILTER: HierarchyFilter = {
  name: 'Tier5',
  apply: (page) =>
    applyCheckboxFilter(page, /Tier/i, 'search-dropdown-Tier', 'tier.tier5'),
};
const PERSONAL_DATA_FILTER: HierarchyFilter = {
  name: 'PersonalData.Personal',
  apply: (page) =>
    applyTagFilter(page, 'PersonalData', /personaldata\.personal/i),
};
const PII_FILTER: HierarchyFilter = {
  name: 'PII.Sensitive',
  apply: (page) => applyTagFilter(page, 'PII', /pii\.sensitive/i),
};
const ENTITY_TYPE_FILTER: HierarchyFilter = {
  name: 'Entity Type table',
  apply: (page) =>
    applyCheckboxFilter(
      page,
      /Entity Type/i,
      'search-dropdown-entityType',
      'table'
    ),
};

// Every table not listed in `visible` is asserted hidden.
const HIERARCHY_SCENARIOS: {
  scope: string;
  path: HierarchySubDomain[];
  filter?: HierarchyFilter;
  visible: HierarchyTable[];
}[] = [
  {
    scope: 'SubDomain1',
    path: ['subDomain1'],
    visible: [
      'subDomain1Table1',
      'subDomain1Table2',
      'subSubDomainTable1',
      'subSubDomainTable2',
    ],
  },
  {
    scope: 'SubDomain1',
    path: ['subDomain1'],
    filter: TIER5_FILTER,
    visible: ['subDomain1Table1', 'subSubDomainTable1'],
  },
  {
    scope: 'SubDomain1',
    path: ['subDomain1'],
    filter: PERSONAL_DATA_FILTER,
    visible: ['subDomain1Table2', 'subSubDomainTable2'],
  },
  {
    scope: 'SubDomain1',
    path: ['subDomain1'],
    filter: PII_FILTER,
    visible: ['subSubDomainTable1'],
  },
  {
    scope: 'SubDomain1',
    path: ['subDomain1'],
    filter: ENTITY_TYPE_FILTER,
    visible: [
      'subDomain1Table1',
      'subDomain1Table2',
      'subSubDomainTable1',
      'subSubDomainTable2',
    ],
  },
  {
    scope: 'SubSubDomain',
    path: ['subDomain1', 'subSubDomain'],
    visible: ['subSubDomainTable1', 'subSubDomainTable2'],
  },
  {
    scope: 'SubSubDomain',
    path: ['subDomain1', 'subSubDomain'],
    filter: TIER5_FILTER,
    visible: ['subSubDomainTable1'],
  },
  {
    scope: 'SubSubDomain',
    path: ['subDomain1', 'subSubDomain'],
    filter: PERSONAL_DATA_FILTER,
    visible: ['subSubDomainTable2'],
  },
  {
    scope: 'SubSubDomain',
    path: ['subDomain1', 'subSubDomain'],
    filter: PII_FILTER,
    visible: ['subSubDomainTable1'],
  },
  {
    scope: 'SubSubDomain',
    path: ['subDomain1', 'subSubDomain'],
    filter: ENTITY_TYPE_FILTER,
    visible: ['subSubDomainTable1', 'subSubDomainTable2'],
  },
  {
    scope: 'SubDomain2 (sibling)',
    path: ['subDomain2'],
    visible: ['subDomain2Table'],
  },
  {
    scope: 'SubDomain2 (sibling)',
    path: ['subDomain2'],
    filter: TIER5_FILTER,
    visible: ['subDomain2Table'],
  },
  {
    scope: 'SubDomain2 (sibling)',
    path: ['subDomain2'],
    filter: ENTITY_TYPE_FILTER,
    visible: ['subDomain2Table'],
  },
  {
    scope: 'RootDomain',
    path: [],
    visible: HIERARCHY_TABLE_KEYS,
  },
  {
    scope: 'RootDomain',
    path: [],
    filter: TIER1_FILTER,
    visible: ['rootTable'],
  },
  {
    scope: 'RootDomain',
    path: [],
    filter: TIER5_FILTER,
    visible: ['subDomain1Table1', 'subSubDomainTable1', 'subDomain2Table'],
  },
];

test.describe('Domain Filter - Multi-nested domain hierarchy', () => {
  // Six tagged tables, each waited on until searchable.
  test.describe.configure({ timeout: API_FIXTURE_TEST_TIMEOUT });

  let rootDomain: Domain;
  let subDomains: Record<HierarchySubDomain, SubDomain>;
  let tables: Record<HierarchyTable, TableClass>;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    rootDomain = new Domain();
    await rootDomain.create(apiContext);
    const subDomain1 = new SubDomain(rootDomain);
    const subDomain2 = new SubDomain(rootDomain);
    await Promise.all([
      subDomain1.create(apiContext),
      subDomain2.create(apiContext),
    ]);
    const subSubDomain = new SubDomain(subDomain1);
    await subSubDomain.create(apiContext);
    subDomains = { subDomain1, subSubDomain, subDomain2 };

    const domains = { rootDomain, ...subDomains };
    tables = Object.fromEntries(
      HIERARCHY_TABLE_KEYS.map((key) => [key, new TableClass()])
    ) as Record<HierarchyTable, TableClass>;

    await Promise.all(
      HIERARCHY_TABLE_KEYS.map(async (key) => {
        const { domain, tags } = HIERARCHY_TABLES[key];
        await tables[key].create(apiContext);
        await assignDomainToEntity(apiContext, tables[key], domains[domain]);
        const { entity } = await tables[key].patch({
          apiContext,
          patchData: tags.map((tagFQN, index) => ({
            op: 'add',
            path: `/tags/${index}`,
            value: { tagFQN, source: 'Classification', labelType: 'Manual' },
          })),
        });

        // Wait for the tagged revision to be the indexed one.
        await waitForSearchIndexed(
          apiContext,
          entity.fullyQualifiedName,
          'all',
          { minVersion: entity.version }
        );
      })
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await Promise.all(
      Object.values(tables).map((table) => table.delete(apiContext))
    );
    // Recursive hard delete also removes the sub-domains.
    await rootDomain.delete(apiContext);
    await afterAction();
  });

  for (const { scope, path, filter, visible } of HIERARCHY_SCENARIOS) {
    test(`${scope} assets${
      filter ? ` with ${filter.name} filter` : ''
    } should scope correctly`, async ({ page }) => {
      await rootDomain.visitEntityPage(page);
      for (const subDomain of path) {
        await navigateToSubDomain(page, subDomains[subDomain].data);
        await waitForAllLoadersToDisappear(page);
      }
      await page.getByTestId('assets').click();
      await waitForAllLoadersToDisappear(page);

      await filter?.apply(page);

      const visibleAssetLinks = (key: HierarchyTable) =>
        page
          .locator(
            `a[href*="${tables[key].entityResponseData.fullyQualifiedName}"]`
          )
          .filter({ visible: true });

      // Visible assertions first: they wait for results to render, so the
      // hidden assertions cannot pass early against an empty list.
      for (const key of visible) {
        await expect(visibleAssetLinks(key)).not.toHaveCount(0);
      }
      for (const key of HIERARCHY_TABLE_KEYS) {
        if (!visible.includes(key)) {
          await expect(visibleAssetLinks(key)).toHaveCount(0);
        }
      }
    });
  }
});
