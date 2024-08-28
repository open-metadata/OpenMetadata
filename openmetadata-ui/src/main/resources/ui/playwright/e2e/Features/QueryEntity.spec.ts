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
import { createQueryByTableName } from '../../utils/query';

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
  tag: 'PersonalData.Personal',
  queryUsedIn: {
    table1: table2.entity.name,
    table2: table3.entity.name,
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
  await table1.visitEntityPage(page);

  await test.step('Create a new query entity', async () => {
    const queryResponse = page.waitForResponse(
      '/api/v1/search/query?q=*&index=query_search_index*'
    );
    await page.click(`[data-testid="table_queries"]`);
    await queryResponse;
    await page.click(`[data-testid="add-query-btn"]`);
    await page
      .getByTestId('code-mirror-container')
      .getByRole('textbox')
      .fill(queryData.query);
    await page.click(
      `.toastui-editor-md-container > .toastui-editor > .ProseMirror`
    );
    await page.keyboard.type(queryData.description);

    await page
      .getByTestId('query-used-in')
      .locator('div')
      .filter({ hasText: 'Please Select a Query Used In' })
      .click();
    await page.keyboard.type(queryData.queryUsedIn.table1);

    await page.click(`[title="${queryData.queryUsedIn.table1}"]`);
    await clickOutside(page);

    await page.click('[data-testid="save-btn"]');
    await page.waitForResponse('/api/v1/queries');
    await page.waitForURL('**/table_queries**');

    await expect(page.locator(`text=${queryData.query}`)).toBeVisible();
  });

  await test.step('Update owner, description and tag', async () => {
    const ownerListResponse = page.waitForResponse('/api/v1/users?*');
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
    await page.click('[data-testid="selectable-list-update-btn"]');
    await page.waitForResponse('/api/v1/queries/*');

    await expect(page.getByRole('link', { name: 'admin' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: queryData.owner })
    ).toBeVisible();

    // Update Description
    await page.click(`[data-testid="edit-description"]`);
    await page.fill(descriptionBox, 'updated description');
    await page.click(`[data-testid="save"]`);
    await page.waitForResponse('/api/v1/queries/*');
    await page.waitForSelector('.ant-modal-body', {
      state: 'detached',
    });

    // Update Tags
    await page.getByTestId('add-tag').click();
    await page.locator('#tagsForm_tags').click();
    await page.locator('#tagsForm_tags').fill(queryData.tag);
    await page.getByTestId(`tag-${queryData.tag}`).click();
    await page.getByTestId('saveAssociatedTag').click();
    await page.waitForResponse('/api/v1/queries/*');
  });
});

test('Verify query duration', async ({ page }) => {
  await redirectToHomePage(page);
  await table2.visitEntityPage(page);
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

test.afterAll(async ({ browser }) => {
  const { afterAction, apiContext } = await createNewPage(browser);
  for (const entity of entityData) {
    await entity.delete(apiContext);
  }
  await afterAction();
});
