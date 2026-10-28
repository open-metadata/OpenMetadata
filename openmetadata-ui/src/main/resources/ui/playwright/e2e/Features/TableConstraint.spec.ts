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
import test, { expect } from '@playwright/test';
import { SearchIndex } from '../../../src/enums/search.enum';
import {
  addKeyColumns,
  clickOnDistKeySelector,
  clickOnForeignKeySelector,
  clickOnSortKeySelector,
  clickOnUniqueKeySelector,
  removeKeyColumns,
} from '../../constant/tableConstraint';
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  redirectToHomePage,
  selectOptionWithRetry,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();

test.describe('Table Constraints', {}, () => {
  const columnName1 = table.children[0].name;
  const columnName2 = table.children[1].name;
  const columnName3 = table.children[2].name;
  const columnName4 = table.children[3].name;

  test.beforeAll('Prerequisite', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await table.createAdditionalTable(
      {
        name: `pw-table-${uuid()}`,
        displayName: `pw table ${uuid()}`,
      },
      apiContext
    );
    await afterAction();
  });

  test.afterAll('cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test('Table Constraint', async ({ page }) => {
    await redirectToHomePage(page);

    await test.step('Add Constraints', async () => {
      await table.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);

      await page.click('[data-testid="table-constraints-add-button"]');
      await page.getByTestId('table-constraint-modal').waitFor();

      // Add for Primary Key

      await expect(page.getByTestId('constraint-type-select')).toContainText(
        'Primary key'
      );
      await addKeyColumns(page, 'primary-constraint-type-select', [
        columnName1,
        columnName2,
      ]);

      // Foreign Key Constraint Section

      const columnName = table.entityResponseData?.['columns'][0].name;
      const relatedColumnFQN =
        table.additionalEntityTableResponseData[0]?.['columns'][1]
          .fullyQualifiedName;

      if (!relatedColumnFQN) {
        throw new Error(
          'The related table column is missing its fully qualified name'
        );
      }

      await clickOnForeignKeySelector(page);

      await selectOptionWithRetry(
        page.getByTestId('0-column-type-select').getByRole('button'),
        page.getByRole('option', { name: columnName, exact: true })
      );
      await selectOptionWithRetry(
        page.getByTestId('0-relationship-type-select').getByRole('button'),
        page.getByRole('option', { name: 'One to One', exact: true })
      );

      // select 2nd Table column as related column
      const querySearchResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        const query = (url.searchParams.get('q') ?? '').replace(/\\(.)/g, '$1');

        return (
          response.request().method() === 'GET' &&
          url.pathname === '/api/v1/search/query' &&
          url.searchParams.get('index') === SearchIndex.TABLE &&
          query.includes(relatedColumnFQN)
        );
      });
      await page
        .getByTestId('0-related-column-select')
        .getByRole('combobox')
        .fill(relatedColumnFQN);

      expect((await querySearchResponse).status()).toBe(200);

      await page.getByTestId(`option-label-${relatedColumnFQN}`).click();

      // Unique Constraint Section
      await clickOnUniqueKeySelector(page);
      await addKeyColumns(page, 'unique-constraint-type-select', [
        columnName3,
        columnName4,
      ]);

      // Dist Constraint Section
      await clickOnDistKeySelector(page);
      await addKeyColumns(page, 'dist-constraint-type-select', [
        columnName1,
        columnName2,
      ]);

      // Sort Constraint Section
      await clickOnSortKeySelector(page);
      await addKeyColumns(page, 'sort-constraint-type-select', [
        columnName3,
        columnName4,
      ]);

      const saveResponse = page.waitForResponse('/api/v1/tables/*');
      await page.click('[data-testid="save-btn"]');
      await saveResponse;

      await page.getByTestId('table-constraint-modal').waitFor({
        state: 'detached',
      });
    });

    await test.step('Verify Constraints Data', async () => {
      await expect(
        page.getByTestId('table-constraints-add-button')
      ).not.toBeVisible();
      await expect(
        page.getByTestId('edit-table-constraint-button')
      ).toBeVisible();

      // Verify Primary Key
      await expect(page.getByTestId('PRIMARY_KEY-container')).toContainText(
        `${columnName2}${columnName1}`
      );
      await expect(page.getByTestId('PRIMARY_KEY-icon')).toBeVisible();

      // Verify Foreign Key
      await expect(page.getByTestId('FOREIGN_KEY-container')).toContainText(
        `${columnName1}${table.additionalEntityTableResponseData[0]?.['columns'][1].fullyQualifiedName}`
      );
      await expect(page.getByTestId('FOREIGN_KEY-icon')).toBeVisible();

      // Verify Unique Key
      await expect(page.getByTestId('UNIQUE-container')).toContainText(
        `${columnName4}${columnName3}`
      );
      await expect(page.getByTestId('UNIQUE-icon')).toBeVisible();

      // Verify Sort Key
      await expect(page.getByTestId('SORT_KEY-container')).toContainText(
        `${columnName4}${columnName3}`
      );
      await expect(page.getByTestId('SORT_KEY-icon')).toBeVisible();

      // Verify Dist Key
      await expect(page.getByTestId('DIST_KEY-container')).toContainText(
        `${columnName2}${columnName1}`
      );
      await expect(page.getByTestId('DIST_KEY-icon')).toBeVisible();
    });

    await test.step('Remove Constraints', async () => {
      await page.getByTestId('edit-table-constraint-button').click();

      // Clear Primary Key
      await removeKeyColumns(page, 'primary-constraint-type-select', [
        columnName1,
        columnName2,
      ]);

      // Clear Foreign Key
      await clickOnForeignKeySelector(page);
      await page.click('[data-testid="0-delete-constraint-button"]');

      // Clear Unique Key
      await clickOnUniqueKeySelector(page);
      await removeKeyColumns(page, 'unique-constraint-type-select', [
        columnName3,
        columnName4,
      ]);

      const saveResponseOne = page.waitForResponse('/api/v1/tables/*');
      await page.click('[data-testid="save-btn"]');
      await saveResponseOne;

      await page.getByTestId('table-constraint-modal').waitFor({
        state: 'detached',
      });

      // Verify Sort and Dist Key to be available
      await expect(page.getByTestId('SORT_KEY-container')).toContainText(
        `${columnName4}${columnName3}`
      );
      await expect(page.getByTestId('SORT_KEY-icon')).toBeVisible();
      await expect(page.getByTestId('DIST_KEY-container')).toContainText(
        `${columnName2}${columnName1}`
      );

      // Remove the pending constraints

      await page.getByTestId('edit-table-constraint-button').click();
      await page.getByTestId('table-constraint-modal').waitFor();

      // Clear Dist Key
      await clickOnDistKeySelector(page);
      await removeKeyColumns(page, 'dist-constraint-type-select', [
        columnName1,
        columnName2,
      ]);

      // Clear Sort Key
      await clickOnSortKeySelector(page);
      await removeKeyColumns(page, 'sort-constraint-type-select', [
        columnName3,
        columnName4,
      ]);

      const saveResponse = page.waitForResponse('/api/v1/tables/*');
      await page.click('[data-testid="save-btn"]');
      await saveResponse;

      await page.getByTestId('table-constraint-modal').waitFor({
        state: 'detached',
      });

      await expect(
        page.getByTestId('table-constraints-add-button')
      ).toBeVisible();
      await expect(
        page.getByTestId('edit-table-constraint-button')
      ).not.toBeVisible();
    });
  });
});
