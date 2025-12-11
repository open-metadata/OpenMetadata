/*
 *  Copyright 2025 Collate.
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

// Pagination is performed for "performance_test_table" Table Entity
export const columnPaginationTable = async (page: Page) => {
  // 50 Row + 1 Header row
  expect(page.getByTestId('entity-table').getByRole('row')).toHaveCount(51);

  expect(page.getByTestId('page-indicator')).toHaveText(`Page 1 of 40`);

  await page.getByTestId('next').click();

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  expect(page.getByTestId('page-indicator')).toHaveText(`Page 2 of 40`);

  expect(page.getByTestId('entity-table').getByRole('row')).toHaveCount(51);

  await page.getByTestId('previous').click();

  expect(page.getByTestId('page-indicator')).toHaveText(`Page 1 of 40`);

  // Change page size to 15
  await page.getByTestId('page-size-selection-dropdown').click();
  await page.getByRole('menuitem', { name: '15 / Page' }).click();

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  // 15 Row + 1 Header row
  expect(page.getByTestId('entity-table').getByRole('row')).toHaveCount(16);

  // Change page size to 25
  await page.getByTestId('page-size-selection-dropdown').click();
  await page.getByRole('menuitem', { name: '25 / Page' }).click();

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  // 25 Row + 1 Header row
  expect(page.getByTestId('entity-table').getByRole('row')).toHaveCount(26);
};
