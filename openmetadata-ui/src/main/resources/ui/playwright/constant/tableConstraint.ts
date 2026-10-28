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
import { expect, Locator, Page } from '@playwright/test';

// The constraint modal's option lists can open at a provisional position and jump into place a few
// frames later, so a pointer pick can press one option and release on the page or on another option.
// These helpers pick with the keyboard, which does not depend on where the list is drawn.

/**
 * Picks a Select option by focusing it and pressing Enter, retrying until `selected` shows. A
 * repeat after the pick took is a no-op, so the retry cannot change a correct selection.
 */
export const pickSelectOption = async (
  trigger: Locator,
  option: Locator,
  selected: Locator
) => {
  await expect(async () => {
    if (await selected.isVisible()) {
      return;
    }
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.press('Enter', { timeout: 2_000 });
    }
    await option.press('Enter', { timeout: 2_000 });
    await expect(selected).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
};

const selectConstraintType = async (page: Page, type: RegExp) => {
  const trigger = page
    .getByTestId('constraint-type-select')
    .getByRole('button');
  await pickSelectOption(
    trigger,
    page.getByRole('option', { name: type }),
    trigger.filter({ hasText: type })
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

/**
 * Adds each column as a chip to a key-constraint multi-select: types the column so it is the only
 * suggestion, then picks it with ArrowDown + Enter. A picked column leaves the suggestions, so a
 * repeat can never unselect it.
 */
export const addKeyColumns = async (
  page: Page,
  testId: string,
  columns: string[]
) => {
  const field = page.getByTestId(testId);
  const input = field.getByRole('combobox');
  const suggestions = page.getByRole('listbox', { name: 'Suggestions' });
  for (const column of columns) {
    const chip = field
      .getByTestId('autocomplete-selected-item')
      .filter({ hasText: column });
    await expect(async () => {
      if ((await chip.count()) === 0) {
        await input.fill(column, { timeout: 5_000 });
        await expect(
          suggestions.getByRole('option', { name: column, exact: true })
        ).toBeVisible({ timeout: 5_000 });
        await expect(suggestions.getByRole('option')).toHaveCount(1, {
          timeout: 2_000,
        });
        await input.press('ArrowDown', { timeout: 2_000 });
        await input.press('Enter', { timeout: 2_000 });
      }
      await expect(chip).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  }
  await page.keyboard.press('Escape');
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
