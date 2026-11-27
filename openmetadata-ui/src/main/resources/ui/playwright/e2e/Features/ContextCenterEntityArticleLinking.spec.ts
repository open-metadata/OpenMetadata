/*
 *  Copyright 2026 Collate.
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
import { expect, Page } from '@playwright/test';
import { KnowledgeCenterResponseDataType } from '../../support/entity/KnowledgeCenter.interface';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, uuid } from '../../utils/common';
import {
  createArticleViaApi,
  deleteArticleByFqn,
} from '../../utils/ContextCenterUtil';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForSearchIndexed } from '../../utils/polling';
import { test } from '../fixtures/pages';

const table = new TableClass();
let article: KnowledgeCenterResponseDataType;

const waitForUsageCall = (page: Page, method: 'PUT' | 'DELETE') =>
  page.waitForResponse(
    (res) =>
      res.request().method() === method &&
      res.url().includes(`/api/v1/contextCenter/pages/${article.id}/usage`)
  );

test.describe('Link Context Center articles from an entity page', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    article = await createArticleViaApi(apiContext, {
      displayName: `CC Entity Link ${uuid()}`,
    });
    // The picker reads from search, so the article must be indexed first.
    await waitForSearchIndexed(apiContext, article.fullyQualifiedName, 'page');
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await deleteArticleByFqn(apiContext, article.fullyQualifiedName);
    await table.delete(apiContext);
    await afterAction();
  });

  test('admin links and unlinks an article from the table widget', async ({
    page,
  }) => {
    test.slow();

    const widget = page.getByTestId('knowledge-center');
    const articleLink = widget
      .getByTestId('page-link')
      .filter({ hasText: article.displayName });

    await test.step('empty widget is shown with an add action', async () => {
      await table.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);

      await expect(widget).toBeVisible();
      await expect(widget.getByTestId('edit-linked-articles')).toBeVisible();
      await expect(articleLink).toHaveCount(0);
    });

    await test.step('search and link the article from the popover', async () => {
      const popover = page.locator('.article-picker-popover');
      const row = popover.getByTestId(`tree-node-${article.id}`);

      await widget.getByTestId('edit-linked-articles').click();
      await expect(popover).toBeVisible();
      // The tree debounces search; the row showing up is the wait.
      await popover.getByRole('textbox').fill(article.displayName);
      await row.click();

      const linkResponse = waitForUsageCall(page, 'PUT');
      await popover.getByTestId('update-btn').click();
      expect((await linkResponse).ok()).toBe(true);

      await expect(articleLink).toBeVisible();
    });

    await test.step('link persists after reload', async () => {
      await page.reload();
      await waitForAllLoadersToDisappear(page);

      await expect(articleLink).toBeVisible();
    });

    await test.step('unlink the article from the popover', async () => {
      const popover = page.locator('.article-picker-popover');

      await widget.getByTestId('edit-linked-articles').click();
      await expect(popover).toBeVisible();
      await popover.getByRole('textbox').fill(article.displayName);
      await popover.getByTestId(`tree-node-${article.id}`).click();

      const unlinkResponse = waitForUsageCall(page, 'DELETE');
      await popover.getByTestId('update-btn').click();
      expect((await unlinkResponse).ok()).toBe(true);

      await expect(articleLink).toHaveCount(0);
      await expect(widget.getByTestId('edit-linked-articles')).toBeVisible();
    });
  });
});
