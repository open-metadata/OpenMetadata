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
import { Domain } from '../../support/domain/Domain';
import { SubDomain } from '../../support/domain/SubDomain';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { selectDomainFromNavbar } from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Domain Widget Filter - Domain Index Search Fix', () => {
  const domainA = new Domain();
  const domainB = new Domain();
  let subDomainA: SubDomain;

  test.beforeAll('Setup domains', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await domainA.create(apiContext);
    await domainB.create(apiContext);
    subDomainA = new SubDomain(domainA);
    await subDomainA.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup domains', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await subDomainA.delete(apiContext);
    await domainA.delete(apiContext);
    await domainB.delete(apiContext);
    await afterAction();
  });

  test('Domain search should use fullyQualifiedName filter when domain is active', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);

    await selectDomainFromNavbar(page, domainA.responseData);

    const searchRequestPromise = page.waitForRequest((request) => {
      const url = request.url();

      return (
        url.includes('/api/v1/search/query') &&
        url.includes('domain_search_index')
      );
    });

    await page.getByTestId('domain-dropdown').click();
    await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
      state: 'visible',
    });

    await page
      .getByTestId('domain-selectable-tree')
      .getByTestId('searchbar')
      .fill('PW');

    const searchRequest = await searchRequestPromise;
    const requestUrl = searchRequest.url();
    const urlParams = new URL(requestUrl);
    const queryFilter = urlParams.searchParams.get('query_filter');

    expect(queryFilter).not.toBeNull();

    const parsedFilter = JSON.parse(queryFilter as string);
    const mustClauses = parsedFilter.query.bool.must;
    const domainFilterClause = mustClauses.find(
      (clause: Record<string, unknown>) =>
        JSON.stringify(clause).includes('fullyQualifiedName')
    );

    expect(domainFilterClause).toBeDefined();
    expect(JSON.stringify(domainFilterClause)).not.toContain(
      'domains.fullyQualifiedName'
    );
    expect(domainFilterClause.bool.should).toEqual(
      expect.arrayContaining([
        {
          term: {
            fullyQualifiedName: domainA.responseData.fullyQualifiedName,
          },
        },
        {
          prefix: {
            fullyQualifiedName: `${domainA.responseData.fullyQualifiedName}.`,
          },
        },
      ])
    );
  });

  test('Domain dropdown should only show selected domain and its subdomains when filter is active', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);

    await selectDomainFromNavbar(page, domainA.responseData);

    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('domain_search_index') &&
        response.status() === 200
    );

    await page.getByTestId('domain-dropdown').click();
    await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
      state: 'visible',
    });

    await page
      .getByTestId('domain-selectable-tree')
      .getByTestId('searchbar')
      .fill('PW');

    const searchResponse = await searchResponsePromise;
    const responseBody = await searchResponse.json();

    const domainNames = responseBody.hits.hits.map(
      (hit: { _source: { fullyQualifiedName: string } }) =>
        hit._source.fullyQualifiedName
    );

    expect(domainNames).toContain(domainA.responseData.fullyQualifiedName);
    expect(domainNames).not.toContain(
      domainB.responseData.fullyQualifiedName
    );
  });

  test('Clearing domain filter should show all domains in dropdown search', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);

    await selectDomainFromNavbar(page, domainA.responseData);

    await page.getByTestId('domain-dropdown').click();
    await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
      state: 'visible',
    });
    await page.getByTestId('all-domains-selector').click();
    await waitForAllLoadersToDisappear(page);
    await page.waitForLoadState('networkidle');

    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('domain_search_index') &&
        response.status() === 200
    );

    await page.getByTestId('domain-dropdown').click();
    await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
      state: 'visible',
    });

    await page
      .getByTestId('domain-selectable-tree')
      .getByTestId('searchbar')
      .fill('PW');

    const searchResponse = await searchResponsePromise;
    const responseBody = await searchResponse.json();

    const domainNames = responseBody.hits.hits.map(
      (hit: { _source: { fullyQualifiedName: string } }) =>
        hit._source.fullyQualifiedName
    );

    expect(domainNames).toContain(domainA.responseData.fullyQualifiedName);
    expect(domainNames).toContain(domainB.responseData.fullyQualifiedName);
  });
});
