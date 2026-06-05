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

import test, { expect, Locator, Page } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
  await afterAction();
});

async function openQueriesTab(page: Page) {
  const querySearchResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=query') &&
      response.request().method() === 'GET'
  );

  await page.getByTestId('table_queries').click();
  await querySearchResponse;
  await waitForAllLoadersToDisappear(page);
}

async function createQueryFromUi(page: Page, queryText: string) {
  await redirectToHomePage(page);
  await table.visitEntityPage(page);
  await openQueriesTab(page);

  await page.getByTestId('add-query-btn').click();
  await expect(page.getByTestId('query-form')).toBeVisible();

  await page
    .getByTestId('code-mirror-container')
    .getByRole('textbox')
    .fill(queryText);
  await page.locator(descriptionBox).click();
  await page.keyboard.type(`CM6 verification ${uuid()}`);

  const createQueryResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/queries') &&
      response.request().method() === 'POST'
  );
  await page.getByTestId('save-btn').click();
  await createQueryResponse;
  await page.waitForURL('**/table_queries**');
  await waitForAllLoadersToDisappear(page);
}

async function waitForQueryCard(
  page: Page,
  queryText: string
): Promise<Locator> {
  const queryCard = page
    .locator('[data-testid="query-card"]')
    .filter({ hasText: queryText })
    .first();

  // Elasticsearch indexing lags after creation. Reload the page (same URL) to
  // remount TableQueries and trigger a fresh ES search, retrying until the
  // newly-created query card appears. Tab-switching cannot be used here because
  // Ant Design keeps inactive tab panels mounted — switching back would not
  // re-fire the useEffect that fetches queries.
  await expect(async () => {
    if (!(await queryCard.isVisible())) {
      await page.reload();
      await waitForAllLoadersToDisappear(page);
    }
    await expect(queryCard).toBeVisible();
  }).toPass({ intervals: [3000], timeout: 60_000 });

  return queryCard;
}

test('Query editor renders on Table Queries tab', async ({ page }) => {
  const queryText = `SELECT '${uuid()}' AS cm6_render_check`;

  await createQueryFromUi(page, queryText);

  const queryCard = await waitForQueryCard(page, queryText);

  await expect(queryCard).toContainText(queryText);
  await expect(queryCard.getByRole('textbox')).toBeVisible();
});

test('Query editor stays visible after tab switch', async ({ page }) => {
  const queryText = `SELECT '${uuid()}' AS cm6_tab_switch_check`;

  await createQueryFromUi(page, queryText);

  const queryCard = await waitForQueryCard(page, queryText);
  const editorTextbox = queryCard.getByRole('textbox');

  await test.step('Navigate to Queries tab — CM6 editor mounts', async () => {
    await expect(queryCard).toContainText(queryText);
    await expect(editorTextbox).toBeVisible();
  });

  await test.step('Switch to Schema tab — Queries panel hidden via display:none', async () => {
    await page.getByTestId('schema').click();
    await waitForAllLoadersToDisappear(page);
  });

  await test.step('Return to Queries tab', async () => {
    await page.getByTestId('table_queries').click();
    await waitForAllLoadersToDisappear(page);

    await expect(queryCard).toBeVisible();
    await expect(queryCard).toContainText(queryText);
    await expect(editorTextbox).toBeVisible();

    const editorHeight = await editorTextbox.evaluate(
      (el) => el.getBoundingClientRect().height
    );
    expect(editorHeight).toBeGreaterThan(0);
  });
});
