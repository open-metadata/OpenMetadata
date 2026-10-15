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
import { expect, Page } from '@playwright/test';
import { selectOptionWithRetry } from '../utils/common';

const selectConstraintType = async (page: Page, type: RegExp) => {
  await selectOptionWithRetry(
    page.getByTestId('constraint-type-select').getByRole('button'),
    page.getByRole('option', { name: type })
  );
};

export const clickOnForeignKeySelector = (page: Page) =>
  selectConstraintType(page, /^foreign key$/i);

export const clickOnUniqueKeySelector = (page: Page) =>
  selectConstraintType(page, /^unique$/i);

export const clickOnDistKeySelector = (page: Page) =>
  selectConstraintType(page, /^dist key$/i);

export const clickOnSortKeySelector = (page: Page) =>
  selectConstraintType(page, /^sort key$/i);

/** Adds each column as a chip to a key-constraint multi-select. */
export const addKeyColumns = async (
  page: Page,
  testId: string,
  columns: string[]
) => {
  const input = page.getByTestId(testId).getByRole('combobox');
  for (const column of columns) {
    await input.fill(column);
    await page.getByRole('option', { name: column, exact: true }).click();
  }
  await page.keyboard.press('Escape');

  for (const column of columns) {
    await expect(page.getByTestId(testId)).toContainText(column);
  }
};

/** Removes each column's chip from a key-constraint multi-select. */
export const removeKeyColumns = async (
  page: Page,
  testId: string,
  columns: string[]
) => {
  for (const column of columns) {
    await page
      .getByTestId(testId)
      .getByTestId('autocomplete-selected-item')
      .filter({ hasText: column })
      .getByRole('button')
      .click();
  }
};
