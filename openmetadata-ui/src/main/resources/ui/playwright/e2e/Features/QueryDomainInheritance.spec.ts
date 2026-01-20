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
import { Domain } from '../../support/domain/Domain';
import { SubDomain } from '../../support/domain/SubDomain';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const { page } = await performAdminLogin(browser);
    await use(page);
    await page.close();
  },
});

/**
 * Helper function to select a domain from the navbar dropdown
 */
const selectDomainFromNavbar = async (
  page: Page,
  domain: { displayName: string; fullyQualifiedName?: string }
) => {
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
    .fill(domain.displayName);
  await searchDomainRes;

  const tagSelector = page.getByTestId(
    `tag-${domain.fullyQualifiedName ?? ''}`
  );
  await tagSelector.waitFor({ state: 'visible' });
  await tagSelector.click();
  await waitForAllLoadersToDisappear(page);
  await page.waitForLoadState('networkidle');
};

/**
 * Helper function to select "All Domains" from navbar
 */
const selectAllDomains = async (page: Page) => {
  await page.getByTestId('domain-dropdown').click();
  await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
    state: 'visible',
  });
  await page.getByTestId('all-domains-selector').click();
  await waitForAllLoadersToDisappear(page);
  await page.waitForLoadState('networkidle');
};

/**
 * Helper function to navigate to Queries tab and wait for queries to load
 */
const navigateToQueriesTab = async (page: Page) => {
  await page.click('[data-testid="table_queries"]');
  await waitForAllLoadersToDisappear(page);
};

/**
 * Helper function to navigate directly to table page via URL
 * Use this when domain filter might exclude the table from search results
 */
const visitTablePageByUrl = async (page: Page, tableFqn: string) => {
  await page.goto(`/table/${encodeURIComponent(tableFqn)}`);
  await page.waitForLoadState('networkidle');
  await waitForAllLoadersToDisappear(page);
};

test.describe('Query Domain Inheritance', () => {
  test.slow(true);

  test('Query visible in Queries Tab when table domain is selected', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const table = new TableClass();

    try {
      // Create domain and table
      await domain.create(apiContext);
      await table.create(apiContext);

      // Assign table to domain
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

      // Create query referencing the table
      // The query INHERITS domains from its referenced tables (via queryUsedIn)
      // Since table has this domain, query will inherit it
      await table.createQuery(apiContext);

      // Navigate to table's entity page
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      // Select domain from navbar - this FILTERS queries by their inherited domains
      // (does not assign domains to queries)
      await selectDomainFromNavbar(page, domain.responseData);

      // Navigate to Queries Tab
      await navigateToQueriesTab(page);

      // Query is visible because it inherited the domain from the table
      await expect(page.locator('[data-testid="query-card"]')).toBeVisible();
    } finally {
      await table.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Query visible with All Domains but hidden with unrelated domain', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain1 = new Domain();
    const domain2 = new Domain();
    const table = new TableClass();

    try {
      // Create two domains and a table
      await domain1.create(apiContext);
      await domain2.create(apiContext);
      await table.create(apiContext);

      // Assign table to domain1 only
      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: domain1.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      // Create query - it inherits domain1 from the table (via queryUsedIn)
      await table.createQuery(apiContext);

      // Navigate to table's entity page
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      // With "All Domains" selected, no domain filter is applied
      await selectAllDomains(page);
      await table.visitEntityPage(page);
      await navigateToQueriesTab(page);

      // Query visible because no domain filter is active
      await expect(page.locator('[data-testid="query-card"]')).toBeVisible();

      // Select domain2 (unrelated to the query's inherited domain)
      await selectDomainFromNavbar(page, domain2.responseData);

      // Navigate to table page via URL (search won't find table since it belongs to domain1)
      await visitTablePageByUrl(
        page,
        table.entityResponseData.fullyQualifiedName
      );
      await navigateToQueriesTab(page);

      // Query NOT visible because it inherited domain1, not domain2
      // The navbar filter excludes queries that don't have the selected domain
      await expect(
        page.locator('[data-testid="query-card"]')
      ).not.toBeVisible();
    } finally {
      await table.delete(apiContext);
      await domain1.delete(apiContext);
      await domain2.delete(apiContext);
      await afterAction();
    }
  });

  test('Query inherits multiple domains from multiple tables', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain1 = new Domain();
    const domain2 = new Domain();
    const table1 = new TableClass();
    const table2 = new TableClass();

    try {
      // Create two domains and two tables
      await domain1.create(apiContext);
      await domain2.create(apiContext);
      await table1.create(apiContext);
      await table2.create(apiContext);

      // Assign table1 to domain1
      await table1.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: domain1.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      // Assign table2 to domain2
      await table2.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: domain2.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      // Create query referencing BOTH tables via queryUsedIn
      // Query inherits domains from ALL referenced tables, so it gets both domain1 and domain2
      const queryResponse = await apiContext.post('/api/v1/queries', {
        data: {
          query: `SELECT * FROM ${table1.entityResponseData.fullyQualifiedName} JOIN ${table2.entityResponseData.fullyQualifiedName}`,
          queryUsedIn: [
            { id: table1.entityResponseData.id, type: 'table' },
            { id: table2.entityResponseData.id, type: 'table' },
          ],
          service: table1.serviceResponseData.name,
        },
      });
      await queryResponse.json();

      // Query should be visible when domain1 is selected (inherited from table1)
      await redirectToHomePage(page);
      await table1.visitEntityPage(page);
      await selectDomainFromNavbar(page, domain1.responseData);
      await table1.visitEntityPage(page);
      await navigateToQueriesTab(page);

      await expect(page.locator('[data-testid="query-card"]')).toBeVisible();

      // Query should also be visible when domain2 is selected (inherited from table2)
      await selectDomainFromNavbar(page, domain2.responseData);
      await table2.visitEntityPage(page);
      await navigateToQueriesTab(page);

      await expect(page.locator('[data-testid="query-card"]')).toBeVisible();
    } finally {
      await table1.delete(apiContext);
      await table2.delete(apiContext);
      await domain1.delete(apiContext);
      await domain2.delete(apiContext);
      await afterAction();
    }
  });

  test('Query domains update when queryUsedIn changes', async ({ page }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const tableWithDomain = new TableClass();
    const tableWithoutDomain = new TableClass();

    try {
      // Create domain and two tables - one with domain, one without
      await domain.create(apiContext);
      await tableWithDomain.create(apiContext);
      await tableWithoutDomain.create(apiContext);

      // Assign domain to only one table
      await tableWithDomain.patch({
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

      // Create query referencing only tableWithoutDomain
      // Query inherits no domains since tableWithoutDomain has no domain
      const queryResponse = await apiContext.post('/api/v1/queries', {
        data: {
          query: `SELECT * FROM ${tableWithoutDomain.entityResponseData.fullyQualifiedName}`,
          queryUsedIn: [
            { id: tableWithoutDomain.entityResponseData.id, type: 'table' },
          ],
          service: tableWithoutDomain.serviceResponseData.name,
        },
      });
      const query = await queryResponse.json();

      // Navigate and select domain filter
      await redirectToHomePage(page);
      await tableWithoutDomain.visitEntityPage(page);
      await selectDomainFromNavbar(page, domain.responseData);

      // Query should NOT be visible - it has no domains inherited
      // Navigate via URL since table has no domain and won't appear in search
      await visitTablePageByUrl(
        page,
        tableWithoutDomain.entityResponseData.fullyQualifiedName
      );
      await navigateToQueriesTab(page);

      await expect(
        page.locator('[data-testid="query-card"]')
      ).not.toBeVisible();

      // Update queryUsedIn to also include tableWithDomain
      // This triggers domain recomputation - query now inherits domain from tableWithDomain
      await apiContext.patch(`/api/v1/queries/${query.id}`, {
        data: [
          {
            op: 'add',
            path: '/queryUsedIn/-',
            value: { id: tableWithDomain.entityResponseData.id, type: 'table' },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      });

      // Query should now be visible - it inherited domain from tableWithDomain
      await tableWithDomain.visitEntityPage(page);
      await navigateToQueriesTab(page);

      await expect(page.locator('[data-testid="query-card"]')).toBeVisible();
    } finally {
      await tableWithDomain.delete(apiContext);
      await tableWithoutDomain.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Query not visible when table has no domain and domain filter active', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const tableWithoutDomain = new TableClass();

    try {
      // Create a domain and a table WITHOUT assigning domain to table
      await domain.create(apiContext);
      await tableWithoutDomain.create(apiContext);

      // Create query referencing table without domain
      // Query inherits domains from referenced tables - since table has no domain,
      // query will have no domains
      await tableWithoutDomain.createQuery(apiContext);

      // Navigate to table's entity page
      await redirectToHomePage(page);
      await tableWithoutDomain.visitEntityPage(page);

      // With "All Domains" selected, query should be visible
      await selectAllDomains(page);
      await tableWithoutDomain.visitEntityPage(page);
      await navigateToQueriesTab(page);

      await expect(page.locator('[data-testid="query-card"]')).toBeVisible();

      // When a domain filter is active, query should NOT be visible
      // because the query has no domains (inherited from table with no domain)
      await selectDomainFromNavbar(page, domain.responseData);
      // Navigate via URL since table has no domain and won't appear in search
      await visitTablePageByUrl(
        page,
        tableWithoutDomain.entityResponseData.fullyQualifiedName
      );
      await navigateToQueriesTab(page);

      await expect(
        page.locator('[data-testid="query-card"]')
      ).not.toBeVisible();
    } finally {
      await tableWithoutDomain.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Query count on tab matches visible queries with domain filter', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const table = new TableClass();

    try {
      // Create domain and table
      await domain.create(apiContext);
      await table.create(apiContext);

      // Assign table to domain
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

      // Create multiple queries referencing the table
      // All queries inherit domain from table via queryUsedIn
      await table.createQuery(apiContext, 'SELECT * FROM table1');
      await table.createQuery(apiContext, 'SELECT id FROM table1');
      await table.createQuery(apiContext, 'SELECT name FROM table1');

      // Navigate to table's entity page
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      // Select domain from navbar to filter by domain
      await selectDomainFromNavbar(page, domain.responseData);

      // Navigate to table page
      await table.visitEntityPage(page);

      // Get the count from tab label - this count respects the domain filter
      const tabLabel = page.getByTestId('table_queries');
      const countElement = tabLabel.getByTestId('count');
      const countText = await countElement.textContent();
      const expectedCount = parseInt(countText ?? '0', 10);

      // Navigate to Queries Tab
      await navigateToQueriesTab(page);

      // Count visible query cards
      const queryCards = page.locator('[data-testid="query-card"]');
      const actualCount = await queryCards.count();

      // Tab count should match actual visible queries (all 3 inherit domain from table)
      expect(actualCount).toBe(expectedCount);
      expect(actualCount).toBe(3);
    } finally {
      await table.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  test('Query visible through deep nested subdomain hierarchy', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const unrelatedDomain = new Domain();
    const table = new TableClass();

    let subDomain1: SubDomain | undefined;
    let subDomain2: SubDomain | undefined;

    try {
      // Create domain hierarchy: Domain -> SubDomain1 -> SubDomain2
      await domain.create(apiContext);
      await unrelatedDomain.create(apiContext);

      subDomain1 = new SubDomain(domain);
      await subDomain1.create(apiContext);

      subDomain2 = new SubDomain(subDomain1);
      await subDomain2.create(apiContext);

      // Create table and assign to deepest subdomain (SubDomain2)
      await table.create(apiContext);
      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: subDomain2.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      // Create query - it inherits SubDomain2 from table via queryUsedIn
      await table.createQuery(apiContext);

      await redirectToHomePage(page);

      // Test 1: Query visible when parent Domain is selected
      // Domain filter uses prefix matching, so selecting parent domain shows queries
      // that belong to any subdomain under it
      await table.visitEntityPage(page);
      await selectDomainFromNavbar(page, domain.responseData);
      await table.visitEntityPage(page);
      await navigateToQueriesTab(page);

      await expect(
        page.locator('[data-testid="query-card"]')
      ).toBeVisible({ timeout: 10000 });

      // Test 2: Query visible when SubDomain1 is selected (prefix matching)
      await selectDomainFromNavbar(page, subDomain1.responseData);
      await table.visitEntityPage(page);
      await navigateToQueriesTab(page);

      await expect(
        page.locator('[data-testid="query-card"]')
      ).toBeVisible({ timeout: 10000 });

      // Test 3: Query visible when SubDomain2 is selected (exact match)
      await selectDomainFromNavbar(page, subDomain2.responseData);
      await table.visitEntityPage(page);
      await navigateToQueriesTab(page);

      await expect(
        page.locator('[data-testid="query-card"]')
      ).toBeVisible({ timeout: 10000 });

      // Test 4: Query NOT visible when unrelated domain is selected
      // Query's inherited domain (SubDomain2) is not under unrelatedDomain
      await selectDomainFromNavbar(page, unrelatedDomain.responseData);
      // Navigate via URL since table belongs to subDomain2, not unrelatedDomain
      await visitTablePageByUrl(
        page,
        table.entityResponseData.fullyQualifiedName
      );
      await navigateToQueriesTab(page);

      await expect(
        page.locator('[data-testid="query-card"]')
      ).not.toBeVisible();
    } finally {
      await table.delete(apiContext);
      if (subDomain2) {
        await subDomain2.delete(apiContext);
      }
      if (subDomain1) {
        await subDomain1.delete(apiContext);
      }
      await domain.delete(apiContext);
      await unrelatedDomain.delete(apiContext);
      await afterAction();
    }
  });

  test('Query loses domain when table is removed from queryUsedIn', async ({
    page,
  }) => {
    const { afterAction, apiContext } = await getApiContext(page);
    const domain = new Domain();
    const tableWithDomain = new TableClass();
    const tableWithoutDomain = new TableClass();

    try {
      // Create domain and two tables
      await domain.create(apiContext);
      await tableWithDomain.create(apiContext);
      await tableWithoutDomain.create(apiContext);

      // Assign domain to only one table
      await tableWithDomain.patch({
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

      // Create query referencing BOTH tables
      // Query inherits domain from tableWithDomain
      const queryResponse = await apiContext.post('/api/v1/queries', {
        data: {
          query: `SELECT * FROM ${tableWithDomain.entityResponseData.fullyQualifiedName} JOIN ${tableWithoutDomain.entityResponseData.fullyQualifiedName}`,
          queryUsedIn: [
            { id: tableWithDomain.entityResponseData.id, type: 'table' },
            { id: tableWithoutDomain.entityResponseData.id, type: 'table' },
          ],
          service: tableWithDomain.serviceResponseData.name,
        },
      });
      const query = await queryResponse.json();

      // Verify query is visible when domain is selected
      await redirectToHomePage(page);
      await tableWithDomain.visitEntityPage(page);
      await selectDomainFromNavbar(page, domain.responseData);
      await tableWithDomain.visitEntityPage(page);
      await navigateToQueriesTab(page);

      await expect(page.locator('[data-testid="query-card"]')).toBeVisible();

      // Remove tableWithDomain from queryUsedIn
      // This triggers domain recomputation - query loses the domain
      await apiContext.patch(`/api/v1/queries/${query.id}`, {
        data: [
          {
            op: 'remove',
            path: '/queryUsedIn/0',
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      });

      // Query should no longer be visible with domain filter
      // (it lost the domain when tableWithDomain was removed)
      await visitTablePageByUrl(
        page,
        tableWithoutDomain.entityResponseData.fullyQualifiedName
      );
      await navigateToQueriesTab(page);

      await expect(
        page.locator('[data-testid="query-card"]')
      ).not.toBeVisible();

      // Query should still be visible with "All Domains"
      await selectAllDomains(page);
      await visitTablePageByUrl(
        page,
        tableWithoutDomain.entityResponseData.fullyQualifiedName
      );
      await navigateToQueriesTab(page);

      await expect(page.locator('[data-testid="query-card"]')).toBeVisible();
    } finally {
      await tableWithDomain.delete(apiContext);
      await tableWithoutDomain.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

});
