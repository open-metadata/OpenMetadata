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
import { expect } from '@playwright/test';
import {
  SHORTCUTS,
  SLASH_COMMANDS,
} from '../../constant/KnowledgeCenter.constant';
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  redirectToHomePage,
  resolveDescriptionBox,
} from '../../utils/common';
import { executeSlashCommand } from '../../utils/KnowledgeCenter';
import { test } from '../fixtures/pages';

let table: TableClass;

test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  table = new TableClass();
  await table.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await table.visitEntityPage(page);
});

test.describe('BlockEditor embed-link form', { tag: ['@Discovery'] }, () => {
  test('entering an invalid URL shows validation error and does not crash the editor', async ({
    page,
  }) => {
    await page.getByTestId('edit-description').click();

    const editor = await resolveDescriptionBox(page);
    await editor.click();
    await page.keyboard.press(SHORTCUTS.enter);
    await executeSlashCommand(page, SLASH_COMMANDS.image);
    await page.getByTestId('add-image-container').click();

    const embedForm = page.getByTestId('embed-link-form');
    await expect(embedForm).toBeVisible();

    const urlInput = page.getByTestId('embed-input');
    await urlInput.clear();
    await urlInput.fill('not-a-valid-url');

    await embedForm.getByRole('button', { name: /embed image/i }).click();

    await expect(embedForm.getByText('Invalid URL')).toBeVisible();

    // Editor must still be alive — not replaced by an error boundary.
    await expect(editor).toBeVisible();
  });
});
