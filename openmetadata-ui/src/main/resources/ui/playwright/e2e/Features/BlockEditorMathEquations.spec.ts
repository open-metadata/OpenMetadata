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
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
} from '../../utils/common';
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

test.describe('BlockEditor math equations', { tag: ['@Discovery'] }, () => {
  test('math equation inserted with $$ syntax persists after save and reload', async ({
    page,
  }) => {
    await page.getByTestId('edit-description').click();

    // Scope editor to the modal — the editor opens in [role="dialog"].description-markdown-editor,
    // NOT inside asset-description-container (that's the view-only container)
    const editor = page
      .locator('[role="dialog"].description-markdown-editor')
      .locator(descriptionBox);

    await expect(editor).toBeVisible();
    await editor.click();

    // Type the equation — keyboard input is required to trigger the $$ input rule
    await page.keyboard.type('$$x^2 + y^2 = z^2$$');

    // The input rule should have converted the typed text to a MathEquation node
    await expect(editor.locator('.block-math-equation')).toBeVisible();

    // Hoist waitForResponse above the click that triggers it (Playwright lint rule)
    const patchRequest = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' && response.status() === 200
    );
    await page.getByTestId('save').click();
    await patchRequest;

    // After save the description container should contain the rendered equation
    await expect(
      page
        .getByTestId('asset-description-container')
        .locator('.block-math-equation')
    ).toBeVisible();

    // Reload to verify persistence through the full save→backend→reload round-trip
    await page.reload();
    await expect(
      page
        .getByTestId('asset-description-container')
        .locator('.block-math-equation')
    ).toBeVisible();
  });
});
