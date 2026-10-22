/*
 *  Copyright 2024 Collate.
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
import test, { expect } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { CODE_EDITOR_LINE } from '../../utils/codeEditor';
import {
  clickOutside,
  createNewPage,
  descriptionBox,
  fillDescriptionBox,
  redirectToHomePage,
  scrollIntoViewAndSettle,
  selectOptionWithRetry,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { getRecordsControl } from '../../utils/pagination';
import { waitForSearchIndexed } from '../../utils/polling';
import { createQueryByTableName, queryFilters } from '../../utils/query';

const QUERY_SEARCH_INDEX = 'query_search_index';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table1 = new TableClass();
const table2 = new TableClass();
const table3 = new TableClass();
const user1 = new UserClass();
const user2 = new UserClass();
const entityData = [table1, table2, table3, user1, user2];
const queryData = {
  query: `select * from table ${table1.entity.name}`,
  description: 'select all the field from table',
  owner: user1.getUserDisplayName(),
  tagFqn: 'PersonalData.Personal',
  tagName: 'Personal',
  queryUsedIn: {
    table1: table2.entity.displayName,
    table2: table3.entity.displayName,
  },
};

test.beforeAll(async ({ browser }) => {
  const { afterAction, apiContext } = await createNewPage(browser);
  for (const entity of entityData) {
    await entity.create(apiContext);
  }
  const table2Query = await createQueryByTableName({
    apiContext,
    tableResponseData: table2.entityResponseData,
  });
  // The Queries tab searches once when it opens and never re-queries.
  await waitForSearchIndexed(
    apiContext,
    table2Query.fullyQualifiedName,
    QUERY_SEARCH_INDEX
  );

  // set owner name for queryData
  queryData.owner = user1.getUserDisplayName();

  await afterAction();
});

test('Query Entity', async ({ page }) => {
  test.slow(true);

  await redirectToHomePage(page);
  await table1.visitEntityPage(page);

  await test.step('Create a new query entity', async () => {
    const queryResponse = page.waitForResponse(
      '/api/v1/search/query?q=*&index=query*'
    );
    await page.click(`[data-testid="table_queries"]`);
    const tableResponse = page.waitForResponse(
      '/api/v1/search/query?q=&index=table&from=0&size=*'
    );
    await queryResponse;
    await page.click(`[data-testid="add-query-btn"]`);
    await tableResponse;
    await page
      .getByTestId('code-mirror-container')
      .getByRole('textbox')
      .fill(queryData.query);
    await page.click(descriptionBox);
    await page.keyboard.type(queryData.description);

    const queryUsedInInput = page
      .getByTestId('query-used-in')
      .getByRole('combobox');
    await queryUsedInInput.click();
    const tableSearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*&index=table*`
    );
    await queryUsedInInput.fill(queryData.queryUsedIn.table1);
    await tableSearchResponse;

    await page
      .getByRole('option', { name: queryData.queryUsedIn.table1, exact: true })
      .click();

    await page.keyboard.press('Escape');

    const createQueryResponse = page.waitForResponse('/api/v1/queries');
    await page.click('[data-testid="save-btn"]');
    await createQueryResponse;
    await page.waitForURL('**/table_queries**');

    await page.locator(`text=${queryData.query}`).waitFor({
      state: 'visible',
      timeout: 10000,
    });
  });

  await test.step('Update owner, description and tag', async () => {
    const ownerListResponse = page.waitForResponse(
      '/api/v1/search/query?q=&index=user&*'
    );
    await page
      .getByTestId(
        'entity-summary-resizable-right-panel-container entity-resizable-panel-container'
      )
      .getByTestId('edit-owner')
      .click();
    await ownerListResponse;

    await waitForAllLoadersToDisappear(page);

    await page
      .locator("[data-testid='select-owner-tabs']")
      .getByRole('tab', { name: 'Users' })
      .click();

    const searchOwnerResponse = page.waitForResponse('api/v1/search/query?q=*');
    await page.fill(
      '[data-testid="owner-select-users-search-bar"]',
      queryData.owner
    );
    await searchOwnerResponse;
    await page
      .locator('[data-testid="owner-option"]')
      .filter({ hasText: queryData.owner })
      .click();
    const updateOwnerResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/queries/') &&
        response.request().method() === 'PATCH'
    );
    // eslint-disable-next-line playwright/no-force-option -- element obscured by overlay
    await page.getByRole('button', { name: 'Update' }).click({ force: true });
    await updateOwnerResponse;

    await expect(page.getByTestId('admin')).toBeVisible();
    await expect(page.getByTestId(queryData.owner)).toBeVisible();

    // Update Description
    await page.click(`[data-testid="edit-description"]`);
    await fillDescriptionBox(page, 'updated description');
    const updateDescriptionResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/queries/') &&
        response.request().method() === 'PATCH'
    );
    await page.click(`[data-testid="save"]`);
    await updateDescriptionResponse;
    await page
      .locator('[role="dialog"].description-markdown-editor')
      .waitFor({ state: 'detached' });

    // Update Tags
    await page.getByTestId('add-tag').click();

    await expect(
      page.getByTestId('classification-tag-picker-search')
    ).toBeVisible();

    const searchTagResponse = page.waitForResponse(
      `/api/v1/search/query?q=*${encodeURIComponent(queryData.tagFqn)}*`
    );
    await page
      .getByTestId('classification-tag-picker-search')
      .fill(queryData.tagFqn);
    await searchTagResponse;
    await page.getByTestId(`tree-node-${queryData.tagFqn}`).click();

    await page.getByTestId('update-btn').waitFor({ state: 'visible' });

    const updateTagResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/queries/') &&
        response.request().method() === 'PATCH'
    );
    await expect(page.getByTestId('update-btn')).toBeEnabled();
    await page.getByTestId('update-btn').click();
    await updateTagResponse;
  });

  await test.step('Update query and QueryUsedIn', async () => {
    await page.click('[data-testid="query-btn"]');
    await page.getByTestId('edit-query').click();
    await page.click(CODE_EDITOR_LINE, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.keyboard.type(`${queryData.queryUsedIn.table1}`);
    const tableSearchResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=table')
    );
    await page
      .getByTestId('edit-query-used-in')
      .getByRole('combobox')
      .fill(queryData.queryUsedIn.table2);
    await tableSearchResponse;
    await page
      .getByRole('option')
      .filter({
        has: page.getByText(queryData.queryUsedIn.table2, { exact: true }),
      })
      .click();
    await clickOutside(page);
    const updateQueryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/queries/') &&
        response.request().method() === 'PATCH'
    );
    await page.click('[data-testid="save-query-btn"]');
    await updateQueryResponse;
  });

  await test.step('Verify query filter', async () => {
    const userName = user2.getUserDisplayName();
    await queryFilters({
      filter: userName,
      apiKey: `/api/v1/search/query?*${encodeURI(userName)}*index=user,team*`,
      key: 'Owner',
      page,
    });

    await expect(
      page.locator('[data-testid="no-data-placeholder"]')
    ).toBeVisible();

    await queryFilters({
      filter: queryData.owner,
      apiKey: `/api/v1/search/query?*${encodeURI(
        queryData.owner
      )}*index=user,team*`,
      key: 'Owner',
      page,
    });
    await expect(
      page.locator('[data-testid="query-card"]').filter({ visible: true })
    ).not.toHaveCount(0);

    await queryFilters({
      filter: 'None',
      apiKey: '/api/v1/search/query?*None*index=tag*',
      key: 'Tag',
      page,
    });

    await expect(
      page.locator('[data-testid="no-data-placeholder"]')
    ).toBeVisible();

    await queryFilters({
      filter: queryData.tagName,
      apiKey: `/api/v1/search/query?*${queryData.tagName}*index=tag*`,
      key: 'Tag',
      page,
    });

    await expect(
      page.locator('[data-testid="query-card"]').filter({ visible: true })
    ).not.toHaveCount(0);
  });

  await test.step('Verify vote for query', async () => {
    const upVoteInterceptor = page.waitForResponse(
      (response) =>
        response.url().includes('api/v1/queries/') &&
        response.url().includes('/vote') &&
        response.request().method() === 'PUT'
    );
    await page
      .getByTestId('extra-option-container')
      .getByTestId('up-vote-btn')
      .click();

    const upVoteResponse = await upVoteInterceptor;

    expect(upVoteResponse.status()).toBe(200);

    await page.reload();
    await waitForAllLoadersToDisappear(page);

    await expect(
      page.getByTestId('extra-option-container').getByTestId('up-vote-btn')
    ).toHaveText('1');

    await page
      .getByTestId('extra-option-container')
      .getByTestId('down-vote-btn')
      .click();

    await page.reload();
    await waitForAllLoadersToDisappear(page);

    await expect(
      page.getByTestId('extra-option-container').getByTestId('down-vote-btn')
    ).toHaveText('1');

    await expect(
      page.getByTestId('extra-option-container').getByTestId('up-vote-btn')
    ).toHaveText('0');
  });

  await test.step('Visit full screen view of query and Delete', async () => {
    const queryResponse = page.waitForResponse('/api/v1/queries/*');
    await page.click(`[data-testid="query-entity-expand-button"]`);
    await queryResponse;

    await page.click(`[data-testid="query-btn"]`);
    await page.getByTestId('delete-query').click();
    const deleteQueryResponse = page.waitForResponse('/api/v1/queries/*');
    await page.click(`[data-testid="save-button"]`);
    await deleteQueryResponse;
  });
});

test('Load queries from a URL with page zero', async ({ page }) => {
  await redirectToHomePage(page);
  await table2.visitEntityPage(page);
  await page.getByTestId('table_queries').click();

  const queryCard = page.getByTestId('query-card').filter({
    hasText: `SELECT * FROM SALES-${table2.entity.name}`,
  });
  await expect(queryCard).toBeVisible();

  const url = new URL(page.url());
  url.searchParams.set('queryFrom', '0');
  url.searchParams.set('pageSize', '25');

  const queryResponse = page.waitForResponse((response) => {
    const requestUrl = new URL(response.url());

    return (
      response.request().method() === 'GET' &&
      requestUrl.pathname === '/api/v1/search/query' &&
      requestUrl.searchParams.get('index') === 'query' &&
      requestUrl.searchParams.get('size') === '25'
    );
  });

  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  const response = await queryResponse;

  expect(response.status()).toBe(200);
  expect(new URL(response.url()).searchParams.get('from')).toBe('0');
  await expect(queryCard).toBeVisible();
});

test('Verify query duration', async ({ page }) => {
  await redirectToHomePage(page);
  await table2.visitEntityPage(page);
  const queryResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=query*'
  );
  await page.click(`[data-testid="table_queries"]`);
  const response = await queryResponse;

  expect(response.status()).toBe(200);
  await expect(page.getByTestId('query-run-duration')).toContainText(
    '6.199 sec'
  );
});

test('Verify Query Pagination', async ({ page, browser }) => {
  test.slow(true);

  const { apiContext, afterAction } = await createNewPage(browser);

  const queries = await Promise.all(
    Array.from({ length: 26 }, (_, index) =>
      table1.createQuery(
        apiContext,
        `select * from table ${table1.entity.name} ${index}`
      )
    )
  );
  await Promise.all(
    queries.map((query) =>
      waitForSearchIndexed(
        apiContext,
        query.fullyQualifiedName,
        QUERY_SEARCH_INDEX
      )
    )
  );

  await redirectToHomePage(page);
  await table1.visitEntityPage(page);
  const queryResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=query*'
  );
  await page.click(`[data-testid="table_queries"]`);
  await queryResponse;

  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('previous')).toBeDisabled();

  const nextResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=query&from=15&size=15**'
  );
  await page.click('[data-testid="next"]');
  await nextResponse;

  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('next')).toBeDisabled();

  const previousResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=query&from=0&size=15**'
  );
  await page.click('[data-testid="previous"]');
  await previousResponse;

  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('previous')).toBeDisabled();

  const records = getRecordsControl(page.getByTestId('queries-container'));
  const pageSizeOptions = page.locator(
    '[data-testid^="rows-per-page-option-"]'
  );

  await expect(records).toHaveText('15');

  const pageSizeResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=query&from=0&size=25&deleted=false&query_filter=**'
  );
  // The size list is a non-modal react-aria popover that closes when the
  // pagination row scrolls, so a one-shot open can show nothing. Reopen until
  // the list shows, and assert it on every attempt so a wrong list cannot be
  // skipped by a retry that finds the menu already open.
  await expect(async () => {
    if ((await records.getAttribute('aria-expanded')) !== 'true') {
      await scrollIntoViewAndSettle(records);
      await records.click({ timeout: 5_000 });
    }
    await expect(pageSizeOptions).toHaveText(['15', '25', '50'], {
      timeout: 2_000,
    });
  }).toPass({ timeout: 15_000 });
  await selectOptionWithRetry(
    records,
    page.getByTestId('rows-per-page-option-25')
  );
  const pageSizeResult = await pageSizeResponse;

  expect(pageSizeResult.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);

  await expect(records).toHaveText('25');

  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { afterAction, apiContext } = await createNewPage(browser);
  for (const entity of entityData) {
    await entity.delete(apiContext);
  }
  await afterAction();
});
