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
import {
  clickOutside,
  createNewPage,
  descriptionBox,
  redirectToHomePage,
} from '../../utils/common';
import { createQueryByTableName, queryFilters } from '../../utils/query';

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
  owner: user1.getUserName(),
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
  await createQueryByTableName({
    apiContext,
    tableResponseData: table2.entityResponseData,
  });
  await afterAction();
});

test('Query Entity', async ({ page }) => {
  test.slow(true);

  await redirectToHomePage(page);
  await table1.visitEntityPageWithCustomSearchBox(page);

  await test.step('Create a new query entity', async () => {
    const queryResponse = page.waitForResponse(
      '/api/v1/search/query?q=*&index=query_search_index*'
    );
    await page.click(`[data-testid="table_queries"]`);
    const tableResponse = page.waitForResponse(
      '/api/v1/search/query?q=**&from=0&size=*&index=table_search_index*'
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

    await page
      .getByTestId('query-used-in')
      .locator('div')
      .filter({ hasText: 'Please Select a Query Used In' })
      .click();
    const tableSearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*&index=table_search_index*`
    );
    await page.keyboard.type(queryData.queryUsedIn.table1);
    await tableSearchResponse;

    await page
      .locator('div')
      .filter({ hasText: new RegExp(`^${queryData.queryUsedIn.table1}$`) })
      .first()
      .click();

    await clickOutside(page);

    const createQueryResponse = page.waitForResponse('/api/v1/queries');
    await page.click('[data-testid="save-btn"]');
    await createQueryResponse;
    await page.waitForURL('**/table_queries**');

    await page.waitForSelector(`text=${queryData.query}`, {
      state: 'visible',
      timeout: 10000,
    });
  });

  await test.step('Update owner, description and tag', async () => {
    const ownerListResponse = page.waitForResponse(
      '/api/v1/search/query?q=*isBot:false*index=user_search_index*'
    );
    await page
      .getByTestId(
        'entity-summary-resizable-right-panel-container entity-resizable-panel-container'
      )
      .getByTestId('edit-owner')
      .click();
    await ownerListResponse;

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const searchOwnerResponse = page.waitForResponse('api/v1/search/query?q=*');
    await page.fill(
      '[data-testid="owner-select-users-search-bar"]',
      queryData.owner
    );
    await searchOwnerResponse;
    await page.click(`.ant-popover [title="${queryData.owner}"]`);
    const updateOwnerResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/queries/') &&
        response.request().method() === 'PATCH'
    );
    await page.click('[data-testid="selectable-list-update-btn"]');
    await updateOwnerResponse;

    await expect(page.getByRole('link', { name: 'admin' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: queryData.owner })
    ).toBeVisible();

    // Update Description
    await page.click(`[data-testid="edit-description"]`);
    await page.locator(descriptionBox).fill('updated description');
    const updateDescriptionResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/queries/') &&
        response.request().method() === 'PATCH'
    );
    await page.click(`[data-testid="save"]`);
    await updateDescriptionResponse;
    await page.waitForSelector('.ant-modal-body', {
      state: 'detached',
    });

    // Update Tags
    await page.getByTestId('add-tag').click();
    await page.locator('#tagsForm_tags').click();
    await page.locator('#tagsForm_tags').fill(queryData.tagFqn);
    await page.getByTestId(`tag-${queryData.tagFqn}`).first().click();
    const updateTagResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/queries/') &&
        response.request().method() === 'PATCH'
    );
    await page.getByTestId('saveAssociatedTag').click();
    await updateTagResponse;
  });

  await test.step('Update query and QueryUsedIn', async () => {
    await page.click('[data-testid="query-btn"]');
    await page.click(`[data-menu-id*="edit-query"]`);
    await page.click('.CodeMirror-line', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.keyboard.type(`${queryData.queryUsedIn.table1}`);
    await page.click('[data-testid="edit-query-used-in"]');
    const tableSearchResponse = page.waitForResponse(
      '/api/v1/search/query?q=*&index=table_search_index*'
    );
    await page.keyboard.type(queryData.queryUsedIn.table2);
    await tableSearchResponse;
    await page
      .locator('div')
      .filter({ hasText: new RegExp(`^${queryData.queryUsedIn.table2}$`) })
      .first()
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
    const userName = user2.getUserName();
    await queryFilters({
      filter: userName,
      apiKey: `/api/v1/search/query?*${encodeURI(
        userName
      )}*index=user_search_index,team_search_index*`,
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
      )}*index=user_search_index,team_search_index*`,
      key: 'Owner',
      page,
    });
    const queryCards = await page.$$('[data-testid="query-card"]');

    expect(queryCards.length).toBeGreaterThan(0);

    await queryFilters({
      filter: 'None',
      apiKey: '/api/v1/search/query?*None*index=tag_search_index*',
      key: 'Tag',
      page,
    });

    await expect(
      page.locator('[data-testid="no-data-placeholder"]')
    ).toBeVisible();

    await queryFilters({
      filter: queryData.tagName,
      apiKey: `/api/v1/search/query?*${queryData.tagName}*index=tag_search_index*`,
      key: 'Tag',
      page,
    });

    const updatedQueryCards = await page.$$('[data-testid="query-card"]');

    expect(updatedQueryCards.length).toBeGreaterThan(0);
  });

  await test.step('Visit full screen view of query and Delete', async () => {
    const queryResponse = page.waitForResponse('/api/v1/queries/*');
    await page.click(`[data-testid="query-entity-expand-button"]`);
    await queryResponse;

    await page.click(`[data-testid="query-btn"]`);
    await page.waitForSelector('.ant-dropdown', { state: 'visible' });
    await page.click(`[data-menu-id*="delete-query"]`);
    const deleteQueryResponse = page.waitForResponse('/api/v1/queries/*');
    await page.click(`[data-testid="save-button"]`);
    await deleteQueryResponse;
  });
});

test('Verify query duration', async ({ page }) => {
  await redirectToHomePage(page);
  await table2.visitEntityPageWithCustomSearchBox(page);
  const queryResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=query_search_index*'
  );
  await page.click(`[data-testid="table_queries"]`);
  await queryResponse;
  await page.waitForSelector('[data-testid="query-run-duration"]', {
    state: 'visible',
  });
  const durationText = await page.textContent(
    '[data-testid="query-run-duration"]'
  );

  expect(durationText).toContain('6.199 sec');
});

test('Verify Query Pagination', async ({ page, browser }) => {
  test.slow(true);

  const { apiContext, afterAction } = await createNewPage(browser);

  Array.from({ length: 26 }).forEach(async (_, index) => {
    await table1.createQuery(
      apiContext,
      `select * from table ${table1.entity.name} ${index}`
    );
  });

  await redirectToHomePage(page);
  await table1.visitEntityPageWithCustomSearchBox(page);
  const queryResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=query_search_index*'
  );
  await page.click(`[data-testid="table_queries"]`);
  await queryResponse;

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(page.getByTestId('previous')).toBeDisabled();

  const nextResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=query_search_index&from=15&size=15**'
  );
  await page.click('[data-testid="next"]');
  await nextResponse;

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(page.getByTestId('next')).toBeDisabled();

  const previousResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=query_search_index&from=0&size=15**'
  );
  await page.click('[data-testid="previous"]');
  await previousResponse;

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(page.getByTestId('previous')).toBeDisabled();

  await expect(page.getByText('15 / page')).toBeVisible();

  // Change page size to 25
  await page.locator('.ant-pagination-options-size-changer').click();
  const pageSizeResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=query_search_index&from=0&size=25&query_filter=**'
  );
  await page.getByTitle('25 / Page').click();
  await pageSizeResponse;

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(page.getByText('25 / page')).toBeVisible();

  // check if the page size list is same as the page size list in the dropdown
  await page.locator('.ant-pagination-options-size-changer').click();

  // This is to check in the options only 3 sizes are visible.
  // 15, 25, 50  Derived from locator which is overall and not contain to check the exact text
  await expect(page.locator('.ant-pagination-options')).toHaveText(
    '25 / page15255015 / page25 / page50 / page'
  );

  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { afterAction, apiContext } = await createNewPage(browser);
  for (const entity of entityData) {
    await entity.delete(apiContext);
  }
  await afterAction();
});
