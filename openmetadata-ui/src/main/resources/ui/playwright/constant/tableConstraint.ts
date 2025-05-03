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
import { Page } from '@playwright/test';

export const clickOnForeignKeySelector = async (page: Page) => {
  await page
    .getByTestId('constraint-type-select')
    .getByText('Primary key')
    .click();

  const selectForeignConstraints = page.getByTitle('Foreign Key');
  await selectForeignConstraints.hover();
  await selectForeignConstraints.click();
};

export const clickOnUniqueKeySelector = async (page: Page) => {
  await page
    .getByTestId('constraint-type-select')
    .getByTitle('Foreign key')
    .click();

  const selectUniqueConstraints = page.getByTitle('Unique');
  await selectUniqueConstraints.hover();
  await selectUniqueConstraints.click();
};

export const clickOnDistKeySelector = async (
  page: Page,
  isPrimary?: boolean
) => {
  await page
    .getByTestId('constraint-type-select')
    .getByTitle(isPrimary ? 'Primary key' : 'Unique')
    .click();

  const selectDistKeyConstraints = page.getByTitle('Dist key');
  await selectDistKeyConstraints.hover();
  await selectDistKeyConstraints.click();
};

export const clickOnSortKeySelector = async (page: Page) => {
  await page
    .getByTestId('constraint-type-select')
    .getByTitle('Dist key')
    .click();

  const selectSortKeyConstraints = page.getByTitle('Sort key');
  await selectSortKeyConstraints.hover();
  await selectSortKeyConstraints.click();
};
