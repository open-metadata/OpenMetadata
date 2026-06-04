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
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await table.createQuery(apiContext, 'SELECT 1 FROM dual');
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
  await afterAction();
});

test('CM6 renders on Table Queries tab — no CM5 artifacts', async ({
  page,
}) => {
  await redirectToHomePage(page);
  await table.visitEntityPage(page);

  const queryResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=query*'
  );
  await page.getByTestId('table_queries').click();
  await queryResponse;
  await waitForAllLoadersToDisappear(page);

  const queryCard = page.locator('[data-testid="query-card"]').first();
  await queryCard.waitFor({ state: 'visible' });

  // CM6 read-only (nocursor) editor renders the cm-content as role=textbox
  await expect(queryCard.getByRole('textbox')).toBeVisible();

  // CM5 artifact must be absent after migration
  await expect(page.locator('.CodeMirror')).not.toBeAttached();
});

test('CM6 editor re-renders after tab switch — IntersectionObserver fix', async ({
  page,
}) => {
  test.slow();

  await redirectToHomePage(page);
  await table.visitEntityPage(page);

  await test.step('Navigate to Queries tab — CM6 editor mounts', async () => {
    const queryResponse = page.waitForResponse(
      '/api/v1/search/query?q=*&index=query*'
    );
    await page.getByTestId('table_queries').click();
    await queryResponse;
    await waitForAllLoadersToDisappear(page);

    const queryCard = page.locator('[data-testid="query-card"]').first();
    await queryCard.waitFor({ state: 'visible' });
    await expect(queryCard.getByRole('textbox')).toBeVisible();
  });

  await test.step('Switch to Schema tab — Queries panel hidden via display:none', async () => {
    await page.getByTestId('schema-tab').click();
    await waitForAllLoadersToDisappear(page);
  });

  await test.step('Return to Queries tab — IntersectionObserver triggers requestRefresh()', async () => {
    // Tab content stays in DOM (Ant Design keeps it, just toggles display:none).
    // No API re-fetch happens on return — just wait for the panel to become visible.
    await page.getByTestId('table_queries').click();

    const queryCard = page.locator('[data-testid="query-card"]').first();
    await queryCard.waitFor({ state: 'visible' });
    await expect(queryCard.getByRole('textbox')).toBeVisible();

    // Non-zero height validates the IntersectionObserver fix worked
    const cmEditor = page.locator('.cm-editor').first();
    const editorHeight = await cmEditor.evaluate(
      (el) => el.getBoundingClientRect().height
    );
    expect(editorHeight).toBeGreaterThan(0);
  });
});
