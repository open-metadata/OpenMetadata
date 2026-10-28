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
import { expect, test } from '../../support/fixtures/base';

import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  getBulkEditGridCell,
  selectBulkEditTagsCell,
} from '../../utils/importUtils';

const TAG_FQN = 'PII.Sensitive';

test.use({
  storageState: 'playwright/.auth/admin.json',
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write'],
  },
});

let table: TableClass;

test.describe('Bulk edit table grid interactions', () => {
  test.beforeAll(async ({ browser }) => {
    table = new TableClass();
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/columns/0/tags/0',
          value: { tagFQN: TAG_FQN, source: 'Classification' },
        },
      ],
    });
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
    await page.getByTestId('bulk-edit-table').click();
    await expect(
      await getBulkEditGridCell(page, table.columnsName[0], 'column.name*')
    ).toBeVisible();
  });

  test('select-all inside the description editor selects the text so it can be cleared', async ({
    page,
  }) => {
    const descriptionCell = await getBulkEditGridCell(
      page,
      table.columnsName[0],
      'column.description'
    );
    await descriptionCell.dblclick();

    const editor = page.getByRole('grid').getByRole('textbox');
    await expect(editor).toBeFocused();
    const description = await editor.inputValue();

    expect(description).not.toHaveLength(0);

    await editor.press('ControlOrMeta+a');

    await expect
      .poll(() =>
        editor.evaluate(
          (el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart
        )
      )
      .toBe(description.length);

    await editor.press('Backspace');

    await expect(editor).toHaveValue('');
  });

  test('copies a column tags cell and pastes it onto another row', async ({
    page,
  }) => {
    const sourceTags = await getBulkEditGridCell(
      page,
      table.columnsName[0],
      'column.tags'
    );
    const targetTags = await getBulkEditGridCell(
      page,
      table.columnsName[1],
      'column.tags'
    );
    const targetGlossaryTerms = await getBulkEditGridCell(
      page,
      table.columnsName[1],
      'column.glossaryTerms'
    );

    await selectBulkEditTagsCell(page, table.columnsName[0]);

    await expect(sourceTags).toContainText(TAG_FQN);
    await expect(targetTags).not.toContainText(TAG_FQN);

    await page.keyboard.press('ControlOrMeta+c');

    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(TAG_FQN);

    await selectBulkEditTagsCell(page, table.columnsName[1]);
    await page.keyboard.press('ControlOrMeta+v');

    await expect(targetTags).toContainText(TAG_FQN);
    await expect(targetGlossaryTerms).not.toContainText(TAG_FQN);
  });

  test('search filters column rows and keeps hidden rows when a visible row is edited', async ({
    page,
  }) => {
    const searchInput = page.getByTestId('bulk-edit-search').locator('input');
    const hiddenRow = page
      .getByRole('row')
      .filter({ hasText: table.columnsName[0] });

    await searchInput.fill(table.columnsName[1]);

    await expect(hiddenRow).toBeHidden();

    const displayName = await getBulkEditGridCell(
      page,
      table.columnsName[1],
      'column.displayName'
    );
    await displayName.click();
    await page.keyboard.press('Enter');
    await page.keyboard.type('PW searched display name');
    await page.keyboard.press('Enter');

    await expect(displayName).toContainText('PW searched display name');

    await searchInput.fill('');

    await expect(hiddenRow).toBeVisible();
    await expect(displayName).toContainText('PW searched display name');
  });

  test('pastes onto the searched row, not the row at the same position in the full list', async ({
    page,
  }) => {
    await selectBulkEditTagsCell(page, table.columnsName[0]);
    await page.keyboard.press('ControlOrMeta+c');

    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(TAG_FQN);

    await page
      .getByTestId('bulk-edit-search')
      .locator('input')
      .fill(table.columnsName[1]);
    const targetTags = await getBulkEditGridCell(
      page,
      table.columnsName[1],
      'column.tags'
    );
    await selectBulkEditTagsCell(page, table.columnsName[1]);
    await page.keyboard.press('ControlOrMeta+v');

    await expect(targetTags).toContainText(TAG_FQN);

    await page.getByTestId('bulk-edit-search').locator('input').fill('');

    await expect(
      await getBulkEditGridCell(page, table.columnsName[0], 'column.name*')
    ).toBeVisible();
  });

  test('pastes text copied outside the grid into the selected cell only', async ({
    page,
  }) => {
    const pastedText = 'Customer id, primary key\nSecond paragraph';
    const description = await getBulkEditGridCell(
      page,
      table.columnsName[0],
      'column.description'
    );
    const nextRowDescription = await getBulkEditGridCell(
      page,
      table.columnsName[1],
      'column.description'
    );
    const nextDescriptionBefore = await nextRowDescription.textContent();

    await page.evaluate(
      (text) => navigator.clipboard.writeText(text),
      pastedText
    );
    await description.click();

    await expect(description).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ControlOrMeta+v');

    await expect(description).toContainText('Customer id, primary key');
    await expect(nextRowDescription).toHaveText(nextDescriptionBefore ?? '');
  });

  test('pastes multi-line text onto a column header one line per row', async ({
    page,
  }) => {
    const header = page.getByRole('columnheader', {
      name: 'Column Display Name',
      exact: true,
    });
    const colIndex = await header.getAttribute('aria-colindex');
    const displayNameInRow = (rowIndex: number) =>
      page.locator(
        `.rdg-row[aria-rowindex="${rowIndex}"] [role="gridcell"][aria-colindex="${colIndex}"]`
      );

    await page.evaluate(() =>
      navigator.clipboard.writeText('PW first line\nPW second line')
    );
    await header.click();
    await page.keyboard.press('ControlOrMeta+v');

    await expect(displayNameInRow(2)).toHaveText('PW first line');
    await expect(displayNameInRow(3)).toHaveText('PW second line');
  });
});
