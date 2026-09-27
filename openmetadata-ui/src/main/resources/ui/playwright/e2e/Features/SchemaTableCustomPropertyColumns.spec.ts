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
import { APIRequestContext } from '@playwright/test';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  createCustomPropertyForEntity,
  CustomPropertyTypeByName,
} from '../../utils/customProperty';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { openColumnDropdown, selectColumns } from '../../utils/glossary';
import { getRowByName } from '../../utils/scopedLocators';

const table = new TableClass();
const PROPERTY_VALUE = 'schema table inline value';

let propertyName = '';
let cleanupUser: ((apiContext: APIRequestContext) => Promise<void>) | null =
  null;

test.describe('Schema table column-level custom property columns', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await table.create(apiContext);

    const data = await createCustomPropertyForEntity(
      apiContext,
      EntityTypeEndpoint.TableColumn,
      [CustomPropertyTypeByName.STRING]
    );
    propertyName =
      data.customProperties[CustomPropertyTypeByName.STRING].property.name;
    cleanupUser = data.cleanupUser;

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await cleanupUser?.(apiContext);
    await table.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('property column is hidden by default, toggleable, inline editable and persisted', async ({
    page,
  }) => {
    const columnKey = `columnCustomProperty.${propertyName}`;
    const propertyHeader = page
      .getByTestId('entity-table')
      .getByRole('columnheader', { name: propertyName });

    await test.step('hidden by default but offered in Customize', async () => {
      await table.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);

      await expect(propertyHeader).toBeHidden();

      await openColumnDropdown(page);

      await expect(
        page.getByTestId(`column-menu-item-${columnKey}`)
      ).toBeVisible();
    });

    await test.step('toggling the property shows its column', async () => {
      await selectColumns(page, [columnKey]);

      await expect(propertyHeader).toBeVisible();
    });

    const row = getRowByName(
      page,
      table.columnsName[0],
      '[data-testid="entity-table"] tbody tr'
    );
    const cell = row.getByTestId(propertyName);

    await test.step('value is editable inline from the cell', async () => {
      await expect(cell.getByTestId('property-value')).toContainText('Not set');

      await cell.getByTestId('edit-icon-right-panel').click();

      const valueInput = page.getByTestId('value-input');
      await expect(valueInput).toBeVisible();
      await valueInput.fill(PROPERTY_VALUE);

      const updateColumnResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/columns/name') &&
          response.request().method() === 'PUT' &&
          response.ok()
      );
      await cell.getByTestId('inline-save-btn').click();
      await updateColumnResponse;

      await expect(cell.getByTestId('property-value')).toContainText(
        PROPERTY_VALUE
      );
    });

    await test.step('column visibility and value survive a reload', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);

      await expect(propertyHeader).toBeVisible();
      await expect(cell.getByTestId('property-value')).toContainText(
        PROPERTY_VALUE
      );
    });
  });
});
