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
import { TableClass } from '../support/entity/TableClass';

export const verifyEntities = async (
  page: Page,
  url: string,
  tables: TableClass[]
) => {
  // Change pagination size to 25
  await page
    .getByTestId('pagination')
    .getByTestId('page-size-selection-dropdown')
    .click();
  const fetchResponse = page.waitForResponse(url);
  await page.getByRole('menuitem', { name: '25 / Page' }).click();
  await fetchResponse;

  // Verify all tables are present
  for (const table of tables) {
    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData?.['fullyQualifiedName']}"]`
      )
    ).toBeVisible();
  }
};
