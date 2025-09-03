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
import {
  clickOnDistKeySelector,
  clickOnForeignKeySelector,
  clickOnSortKeySelector,
  clickOnUniqueKeySelector,
} from '../../constant/tableConstraint';
import { TableClass } from '../../support/entity/TableClass';
import {
  clickOutside,
  createNewPage,
  redirectToHomePage,
  uuid,
} from '../../utils/common';

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
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await page.click('[data-testid="table-constraints-add-button"]');
      await page.waitForSelector('[role="dialog"].ant-modal');

      // Add for Primary Key

      await expect(page.getByTestId('constraint-type-select')).toContainText(
        'Primary key'
      );
      await expect(
        page.getByTestId('primary-constraint-type-select')
      ).toBeVisible();

      await page
        .locator(
          '[data-testid="primary-constraint-type-select"] > .ant-select-selector .ant-select-selection-search-input'
        )
        .click();

      await page
        .getByTestId('primary-constraint-type-select')
        .getByRole('combobox')
        .fill(columnName1, { force: true });

      // select 1st value from dropdown
      const firstPrimaryKeyColumn = page.getByTitle(columnName1);
      await firstPrimaryKeyColumn.hover();
      await firstPrimaryKeyColumn.click();

      // select 2nd value  from dropdown
      await page
        .getByTestId('primary-constraint-type-select')
        .getByRole('combobox')
        .fill(columnName2, { force: true });

      const secondPrimaryKeyColumn = page.getByTitle(columnName2);
      await secondPrimaryKeyColumn.hover();
      await secondPrimaryKeyColumn.click();
      await clickOutside(page);

      await expect(
        page
          .getByTestId('primary-constraint-type-select')
          .getByText(`${columnName1}${columnName2}`)
      ).toBeVisible();

      // Foreign Key Constraint Section

      const columnName = table.entityResponseData?.['columns'][0].name;
      const relatedColumnFQN =
        table.additionalEntityTableResponseData[0]?.['columns'][1]
          .fullyQualifiedName;

      await clickOnForeignKeySelector(page);

      await page
        .locator(
          '[data-testid="0-column-type-select"] > .ant-select-selector .ant-select-selection-search-input'
        )
        .click();

      // select value from dropdown
      const columnNameDropdownValue = page
        .getByTitle(columnName)
        .locator('div');
      await columnNameDropdownValue.hover();
      await columnNameDropdownValue.click();
      await clickOutside(page);

      await page
        .locator(
          '[data-testid="0-relationship-type-select"] > .ant-select-selector .ant-select-selection-search-input'
        )
        .click();

      // select value from dropdown
      const relationTypeDropdownValue = page.getByText('One to One');
      await relationTypeDropdownValue.hover();
      await relationTypeDropdownValue.click();
      await clickOutside(page);

      // select 2nd Table column as related column
      const relatedColumnSelect = page.locator(
        '[data-testid="0-related-column-select"] > .ant-select-selector .ant-select-selection-search-input'
      );
      await relatedColumnSelect.click();

      const querySearchResponse = page.waitForResponse(
        `/api/v1/search/query?q=**`
      );
      await relatedColumnSelect.fill(relatedColumnFQN);

      await querySearchResponse;

      // select value from dropdown
      const dropdownValue = page.getByTestId(
        `option-label-${relatedColumnFQN}`
      );
      await dropdownValue.hover();
      await dropdownValue.click();
      await clickOutside(page);

      // Unique Constraint Section
      await clickOnUniqueKeySelector(page);

      await page
        .locator(
          '[data-testid="unique-constraint-type-select"] > .ant-select-selector .ant-select-selection-search-input'
        )
        .click();

      await page
        .getByTestId('unique-constraint-type-select')
        .getByRole('combobox')
        .fill(columnName3, { force: true });

      // select 1st value from dropdown
      const firstUniqueKeyColumn = page.getByTitle(columnName3, {
        exact: true,
      });
      await firstUniqueKeyColumn.hover();
      await firstUniqueKeyColumn.click();

      // select 2nd value  from dropdown
      await page
        .getByTestId('unique-constraint-type-select')
        .getByRole('combobox')
        .fill(columnName4, { force: true });

      const secondUniqueKeyColumn = page.getByTitle(columnName4);
      await secondUniqueKeyColumn.hover();
      await secondUniqueKeyColumn.click();
      await clickOutside(page);

      await expect(
        page
          .getByTestId('unique-constraint-type-select')
          .getByText(`${columnName3}${columnName4}`)
      ).toBeVisible();

      // Dist Constraint Section
      await clickOnDistKeySelector(page);

      await page
        .locator(
          '[data-testid="dist-constraint-type-select"] > .ant-select-selector .ant-select-selection-search-input'
        )
        .click();

      await page
        .getByTestId('dist-constraint-type-select')
        .getByRole('combobox')
        .fill(columnName1, { force: true });

      // select 1st value from dropdown
      const firstDistKeyColumn = page.getByTitle(columnName1);
      await firstDistKeyColumn.hover();
      await firstDistKeyColumn.click();

      // select 2nd value  from dropdown
      await page
        .getByTestId('dist-constraint-type-select')
        .getByRole('combobox')
        .fill(columnName2, { force: true });

      const secondDistKeyColumn = page.getByTitle(columnName2);
      await secondDistKeyColumn.hover();
      await secondDistKeyColumn.click();
      await clickOutside(page);

      await expect(
        page
          .getByTestId('dist-constraint-type-select')
          .getByText(`${columnName1}${columnName2}`)
      ).toBeVisible();

      // Sort Constraint Section
      await clickOnSortKeySelector(page);

      await page
        .locator(
          '[data-testid="sort-constraint-type-select"] > .ant-select-selector .ant-select-selection-search-input'
        )
        .click();

      await page
        .getByTestId('sort-constraint-type-select')
        .getByRole('combobox')
        .fill(columnName3, { force: true });

      // select 1st value from dropdown
      const firstSortKeyColumn = page.getByTitle(columnName3, { exact: true });
      await firstSortKeyColumn.hover();
      await firstSortKeyColumn.click();

      // select 2nd value  from dropdown
      await page
        .getByTestId('sort-constraint-type-select')
        .getByRole('combobox')
        .fill(columnName4, { force: true });

      const secondSortKeyColumn = page.getByTitle(columnName4);
      await secondSortKeyColumn.hover();
      await secondSortKeyColumn.click();
      await clickOutside(page);

      await expect(
        page
          .getByTestId('sort-constraint-type-select')
          .getByText(`${columnName3}${columnName4}`)
      ).toBeVisible();

      const saveResponse = page.waitForResponse('/api/v1/tables/*');
      await page.click('[data-testid="save-btn"]');
      await saveResponse;

      await page.waitForSelector('[role="dialog"].ant-modal', {
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
      await page.click(
        '[data-testid="primary-constraint-type-select"] .anticon-close-circle'
      );

      // Clear Foreign Key
      await clickOnForeignKeySelector(page);
      await page.click('[data-testid="0-delete-constraint-button"]');

      // Clear Unique Key
      await clickOnUniqueKeySelector(page);
      await page.click(
        '[data-testid="unique-constraint-type-select"] .anticon-close-circle'
      );

      const saveResponseOne = page.waitForResponse('/api/v1/tables/*');
      await page.click('[data-testid="save-btn"]');
      await saveResponseOne;

      await page.waitForSelector('[role="dialog"].ant-modal', {
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
      await page.waitForSelector('[role="dialog"].ant-modal');

      // Clear Dist Key
      await clickOnDistKeySelector(page, true);
      await page.click(
        '[data-testid="dist-constraint-type-select"] .anticon-close-circle'
      );

      // Clear Sort Key
      await clickOnSortKeySelector(page);
      await page.click(
        '[data-testid="sort-constraint-type-select"] .anticon-close-circle'
      );

      const saveResponse = page.waitForResponse('/api/v1/tables/*');
      await page.click('[data-testid="save-btn"]');
      await saveResponse;

      await page.waitForSelector('[role="dialog"].ant-modal', {
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
