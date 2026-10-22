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
import { Page } from '@playwright/test';
import { expect, test } from '../../support/fixtures/base';

import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { pressKeyXTimes } from '../../utils/importUtils';

const TAG_FQN = 'PII.Sensitive';

test.use({
  storageState: 'playwright/.auth/admin.json',
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  // Wide enough that react-data-grid renders every column without virtualizing.
  viewport: { width: 3200, height: 1000 },
});

const table = new TableClass();

const getGridCell = async (page: Page, columnName: string, header: string) => {
  const colIndex = await page
    .getByRole('columnheader', { name: header, exact: true })
    .getAttribute('aria-colindex');

  return page
    .getByRole('row')
    .filter({ hasText: columnName })
    .locator(`[role="gridcell"][aria-colindex="${colIndex}"]`);
};

// A click on a tags cell opens its picker, which would take the keyboard
// copy/paste. Select it from the row's name cell (click only selects there).
const selectTagsCell = async (page: Page, columnName: string) => {
  const nameCell = await getGridCell(page, columnName, 'Column Name');
  const tagsCell = await getGridCell(page, columnName, 'Column Tags');
  const [nameIndex, tagsIndex] = await Promise.all([
    nameCell.getAttribute('aria-colindex'),
    tagsCell.getAttribute('aria-colindex'),
  ]);
  await nameCell.click();
  await pressKeyXTimes(
    page,
    Number(tagsIndex) - Number(nameIndex),
    'ArrowRight'
  );

  await expect(tagsCell).toHaveAttribute('aria-selected', 'true');

  return tagsCell;
};

test.describe('Bulk edit table grid interactions', () => {
  test.beforeAll(async ({ browser }) => {
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
      await getGridCell(page, table.columnsName[0], 'Column Name')
    ).toBeVisible();
  });

  test('labels the rows of a table bulk edit as columns', async ({ page }) => {
    await expect(page.getByText(/^Edit \d+ columns$/)).toBeVisible();
    await expect(
      page.getByTestId('bulk-edit-search').locator('input')
    ).toHaveAttribute('placeholder', /^Search \d+ columns$/);
  });

  test('select-all inside the description editor selects the text so it can be cleared', async ({
    page,
  }) => {
    const descriptionCell = await getGridCell(
      page,
      table.columnsName[0],
      'Column Description'
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
    const sourceTags = await getGridCell(
      page,
      table.columnsName[0],
      'Column Tags'
    );
    const targetTags = await getGridCell(
      page,
      table.columnsName[1],
      'Column Tags'
    );
    const targetGlossaryTerms = await getGridCell(
      page,
      table.columnsName[1],
      'Column Glossary Terms'
    );

    await expect(sourceTags).toContainText(TAG_FQN);
    await expect(targetTags).not.toContainText(TAG_FQN);

    await selectTagsCell(page, table.columnsName[0]);
    await page.keyboard.press('ControlOrMeta+c');

    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(TAG_FQN);

    await selectTagsCell(page, table.columnsName[1]);
    await page.keyboard.press('ControlOrMeta+v');

    await expect(targetTags).toContainText(TAG_FQN);
    await expect(targetGlossaryTerms).not.toContainText(TAG_FQN);
  });

  test('search filters column rows and keeps hidden rows when a visible row is edited', async ({
    page,
  }) => {
    const searchInput = page.getByTestId('bulk-edit-search').locator('input');
    const hiddenRowName = await getGridCell(
      page,
      table.columnsName[0],
      'Column Name'
    );

    await searchInput.fill(table.columnsName[1]);

    await expect(hiddenRowName).toBeHidden();

    const displayName = await getGridCell(
      page,
      table.columnsName[1],
      'Column Display Name'
    );
    await displayName.click();
    await page.keyboard.press('Enter');
    await page.keyboard.type('PW searched display name');
    await page.keyboard.press('Enter');

    await expect(displayName).toContainText('PW searched display name');

    await searchInput.fill('');

    await expect(hiddenRowName).toBeVisible();
    await expect(displayName).toContainText('PW searched display name');
  });

  test('pastes onto the searched row, not the row at the same position in the full list', async ({
    page,
  }) => {
    const sourceTags = await getGridCell(
      page,
      table.columnsName[0],
      'Column Tags'
    );
    await selectTagsCell(page, table.columnsName[0]);
    await page.keyboard.press('ControlOrMeta+c');

    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(TAG_FQN);

    await page
      .getByTestId('bulk-edit-search')
      .locator('input')
      .fill(table.columnsName[1]);
    const targetTags = await getGridCell(
      page,
      table.columnsName[1],
      'Column Tags'
    );
    await selectTagsCell(page, table.columnsName[1]);
    await page.keyboard.press('ControlOrMeta+v');

    await expect(targetTags).toContainText(TAG_FQN);

    await page.getByTestId('bulk-edit-search').locator('input').fill('');

    await expect(
      await getGridCell(page, table.columnsName[0], 'Column Name')
    ).toBeVisible();
  });

  test('pastes text copied outside the grid into the selected cell only', async ({
    page,
  }) => {
    const pastedText = 'Customer id, primary key\nSecond paragraph';
    const description = await getGridCell(
      page,
      table.columnsName[0],
      'Column Description'
    );
    const dataTypeDisplay = await getGridCell(
      page,
      table.columnsName[0],
      'Column Data Type Display'
    );
    const nextRowDescription = await getGridCell(
      page,
      table.columnsName[1],
      'Column Description'
    );
    const [dataTypeBefore, nextDescriptionBefore] = await Promise.all([
      dataTypeDisplay.textContent(),
      nextRowDescription.textContent(),
    ]);

    await page.evaluate(
      (text) => navigator.clipboard.writeText(text),
      pastedText
    );
    await description.click();

    await expect(description).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ControlOrMeta+v');

    await expect(description).toContainText('Customer id, primary key');
    await expect(dataTypeDisplay).toHaveText(dataTypeBefore ?? '');
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
