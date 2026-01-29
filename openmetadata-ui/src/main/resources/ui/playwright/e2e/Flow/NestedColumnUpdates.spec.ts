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
import { expect, test } from '@playwright/test';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import {
  assignTagToChildren,
  removeTagsFromChildren,
  updateDescriptionForChildren,
  updateDisplayNameForEntityChildren,
} from '../../utils/entity';

const tableWithNestedColumns = new TableClass();

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Nested Column Updates', () => {
  test.beforeAll('Setup entities', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    tableWithNestedColumns.entity = {
      name: `pw_nested_column_test_${uuid()}`,
      displayName: 'Nested Column Test Table',
      description: 'Table for testing nested column updates',
      tableType: 'SecureView',
      databaseSchema: '',
      columns: [
        {
          name: 'id',
          dataType: 'NUMERIC',
          dataTypeDisplay: 'numeric',
          description: 'ID column',
        },
        {
          name: 'customer_info',
          dataType: 'STRUCT',
          dataTypeDisplay:
            'struct<name:varchar(100),email:varchar(100),address:struct<street:varchar(200),city:varchar(100)>>',
          description: 'Customer information struct',
          children: [
            {
              name: 'name',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar(100)',
              description: 'Customer name',
            },
            {
              name: 'email',
              dataType: 'VARCHAR',
              dataLength: 100,
              dataTypeDisplay: 'varchar(100)',
              description: 'Customer email',
            },
            {
              name: 'address',
              dataType: 'STRUCT',
              dataTypeDisplay: 'struct<street:varchar(200),city:varchar(100)>',
              description: 'Customer address',
              children: [
                {
                  name: 'street',
                  dataType: 'VARCHAR',
                  dataLength: 200,
                  dataTypeDisplay: 'varchar(200)',
                  description: 'Street address',
                },
                {
                  name: 'city',
                  dataType: 'VARCHAR',
                  dataLength: 100,
                  dataTypeDisplay: 'varchar(100)',
                  description: 'City',
                },
              ],
            },
          ],
        },
      ],
    };

    await tableWithNestedColumns.create(apiContext);
    await afterAction();
  });

  test.describe('Level 1 Nested Columns', () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('should update nested column description immediately without page refresh', async ({
      page,
    }) => {
      const nestedColumnFqn = `${tableWithNestedColumns.entityResponseData.fullyQualifiedName}.customer_info.name`;
      const newDescription = 'Updated customer name field description';

      await tableWithNestedColumns.visitEntityPage(page);

      await expect(
        page.locator(`[data-row-key="${nestedColumnFqn}"]`)
      ).toBeVisible();

      await updateDescriptionForChildren(
        page,
        newDescription,
        nestedColumnFqn,
        'data-row-key',
        EntityTypeEndpoint.Table
      );

      await expect(
        page
          .locator(`[data-row-key="${nestedColumnFqn}"]`)
          .getByTestId('viewer-container')
      ).toContainText(newDescription);
    });

    test('should add and remove tags to nested column immediately without refresh', async ({
      page,
    }) => {
      const nestedColumnFqn = `${tableWithNestedColumns.entityResponseData.fullyQualifiedName}.customer_info.email`;
      const testTag = 'PII.Sensitive';

      await tableWithNestedColumns.visitEntityPage(page);

      await expect(
        page.locator(`[data-row-key="${nestedColumnFqn}"]`)
      ).toBeVisible();

      await assignTagToChildren({
        page,
        tag: testTag,
        rowId: nestedColumnFqn,
        entityEndpoint: EntityTypeEndpoint.Table,
      });

      await expect(
        page
          .locator(`[data-row-key="${nestedColumnFqn}"]`)
          .getByTestId(`tag-${testTag}`)
      ).toBeVisible();

      await removeTagsFromChildren({
        page,
        rowId: nestedColumnFqn,
        tags: [testTag],
        entityEndpoint: EntityTypeEndpoint.Table,
      });

      await expect(
        page
          .locator(`[data-row-key="${nestedColumnFqn}"]`)
          .getByTestId(`tag-${testTag}`)
      ).not.toBeVisible();
    });

    test('should update nested column displayName immediately without refresh', async ({
      page,
    }) => {
      const nestedColumnFqn = `${tableWithNestedColumns.entityResponseData.fullyQualifiedName}.customer_info.name`;
      const newDisplayName = 'Customer Full Name';

      await tableWithNestedColumns.visitEntityPage(page);

      await expect(
        page.locator(`[data-row-key="${nestedColumnFqn}"]`)
      ).toBeVisible();

      await updateDisplayNameForEntityChildren(
        page,
        {
          oldDisplayName: '',
          newDisplayName: newDisplayName,
        },
        nestedColumnFqn,
        'data-row-key'
      );

      await expect(
        page
          .locator(`[data-row-key="${nestedColumnFqn}"]`)
          .getByTestId('column-display-name')
      ).toHaveText(newDisplayName);
    });
  });

  test.describe('Level 2 Deeply Nested Columns', () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('should update nested column description immediately without page refresh', async ({
      page,
    }) => {
      const deeplyNestedFqn = `${tableWithNestedColumns.entityResponseData.fullyQualifiedName}.customer_info.address.street`;
      const newDescription = 'Updated street address description';

      await tableWithNestedColumns.visitEntityPage(page);

      await expect(
        page.locator(`[data-row-key="${deeplyNestedFqn}"]`)
      ).toBeVisible();

      await updateDescriptionForChildren(
        page,
        newDescription,
        deeplyNestedFqn,
        'data-row-key',
        EntityTypeEndpoint.Table
      );

      await expect(
        page
          .locator(`[data-row-key="${deeplyNestedFqn}"]`)
          .getByTestId('viewer-container')
      ).toContainText(newDescription);
    });

    test('should add and remove tags to nested column immediately without refresh', async ({
      page,
    }) => {
      const nestedColumnFqn = `${tableWithNestedColumns.entityResponseData.fullyQualifiedName}.customer_info.address.street`;
      const testTag = 'PII.Sensitive';

      await tableWithNestedColumns.visitEntityPage(page);

      await expect(
        page.locator(`[data-row-key="${nestedColumnFqn}"]`)
      ).toBeVisible();

      await assignTagToChildren({
        page,
        tag: testTag,
        rowId: nestedColumnFqn,
        entityEndpoint: EntityTypeEndpoint.Table,
      });

      await expect(
        page
          .locator(`[data-row-key="${nestedColumnFqn}"]`)
          .getByTestId(`tag-${testTag}`)
      ).toBeVisible();

      await removeTagsFromChildren({
        page,
        rowId: nestedColumnFqn,
        tags: [testTag],
        entityEndpoint: EntityTypeEndpoint.Table,
      });

      await expect(
        page
          .locator(`[data-row-key="${nestedColumnFqn}"]`)
          .getByTestId(`tag-${testTag}`)
      ).not.toBeVisible();
    });

    test('should update nested column displayName immediately without refresh', async ({
      page,
    }) => {
      const nestedColumnFqn = `${tableWithNestedColumns.entityResponseData.fullyQualifiedName}.customer_info.address.street`;
      const newDisplayName = 'Street Full Name';

      await tableWithNestedColumns.visitEntityPage(page);

      await expect(
        page.locator(`[data-row-key="${nestedColumnFqn}"]`)
      ).toBeVisible();

      await updateDisplayNameForEntityChildren(
        page,
        {
          oldDisplayName: '',
          newDisplayName: newDisplayName,
        },
        nestedColumnFqn,
        'data-row-key'
      );

      await expect(
        page
          .locator(`[data-row-key="${nestedColumnFqn}"]`)
          .getByTestId('column-display-name')
      ).toHaveText(newDisplayName);
    });
  });
});
