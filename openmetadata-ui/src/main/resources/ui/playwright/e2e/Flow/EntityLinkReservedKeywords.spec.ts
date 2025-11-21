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
import { test } from '../fixtures/pages';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { describeEntity, updateDescription } from '../../utils/entity';

// Create a custom table class with reserved keyword column names
class ReservedKeywordTableClass extends TableClass {
  constructor() {
    super();
    
    // Override column names with reserved keywords from ENTITY_TYPE and ENTITY_FIELD
    this.columnsName = [
      'topic',        // ENTITY_TYPE keyword
      'user',         // ENTITY_TYPE keyword
      'database',     // ENTITY_TYPE keyword
      'role',         // ENTITY_TYPE keyword
      'chart',        // ENTITY_TYPE keyword
      'description',  // ENTITY_FIELD keyword
      'owner',        // ENTITY_FIELD keyword
      'tags',         // ENTITY_FIELD keyword
      'name',         // ENTITY_FIELD keyword
      'tests',        // ENTITY_FIELD keyword
    ];

    this.entityLinkColumnsName = [
      this.columnsName[0], // topic
      this.columnsName[1], // user
      this.columnsName[2], // database
      this.columnsName[3], // role
      this.columnsName[4], // chart
      this.columnsName[5], // description
      this.columnsName[6], // owner
      this.columnsName[7], // tags
      this.columnsName[8], // name
      this.columnsName[9], // tests
    ];

    this.children = [
      {
        name: this.columnsName[0], // topic
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Column named "topic" - an ENTITY_TYPE reserved keyword',
      },
      {
        name: this.columnsName[1], // user
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Column named "user" - an ENTITY_TYPE reserved keyword',
      },
      {
        name: this.columnsName[2], // database
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Column named "database" - an ENTITY_TYPE reserved keyword',
      },
      {
        name: this.columnsName[3], // role
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Column named "role" - an ENTITY_TYPE reserved keyword',
      },
      {
        name: this.columnsName[4], // chart
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Column named "chart" - an ENTITY_TYPE reserved keyword',
      },
      {
        name: this.columnsName[5], // description
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Column named "description" - an ENTITY_FIELD reserved keyword',
      },
      {
        name: this.columnsName[6], // owner
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Column named "owner" - an ENTITY_FIELD reserved keyword',
      },
      {
        name: this.columnsName[7], // tags
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Column named "tags" - an ENTITY_FIELD reserved keyword',
      },
      {
        name: this.columnsName[8], // name
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Column named "name" - an ENTITY_FIELD reserved keyword',
      },
      {
        name: this.columnsName[9], // tests
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Column named "tests" - an ENTITY_FIELD reserved keyword',
      },
    ];

    this.entity = {
      name: `pw-table-reserved-keywords-${Date.now()}`,
      displayName: 'Table with Reserved Keyword Column Names',
      description: 'Test table with columns using reserved keywords from EntityLink grammar',
      columns: this.children,
      tableType: 'Regular',
      databaseSchema: `${this.service.name}.${this.database.name}.${this.schema.name}`,
    };
  }
}

const table = new ReservedKeywordTableClass();

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await table.create(apiContext);
  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await table.delete(apiContext);
  await afterAction();
});

test.describe('EntityLink Grammar with Reserved Keywords', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Should display table with reserved keyword column names correctly', async ({
    page,
  }) => {
    await test.step('Navigate to table entity page', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    });

    await test.step('Verify all reserved keyword columns are visible in schema tab', async () => {
      // Wait for schema table to load
      await page.waitForSelector('[data-testid="entity-schema-table"]');

      // Check each reserved keyword column is present
      for (const columnName of table.columnsName) {
        const columnRow = page.locator(`[data-row-key="${columnName}"]`);
        await expect(columnRow).toBeVisible();
        
        // Verify column name is displayed correctly
        const columnNameCell = columnRow.locator('[data-testid="column-name"]');
        await expect(columnNameCell).toContainText(columnName);
      }
    });
  });

  test('Should allow adding descriptions to columns with reserved keyword names', async ({
    page,
  }) => {
    await test.step('Navigate to table entity page', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    });

    // Test adding description to columns with ENTITY_TYPE keywords
    for (const columnName of ['topic', 'user', 'database']) {
      await test.step(`Add description to column "${columnName}" (ENTITY_TYPE keyword)`, async () => {
        const searchResponse = page.waitForResponse(
          `/api/v1/tables/name/*/columns/search?q=${columnName}&**`
        );
        await page.getByTestId('searchbar').fill(columnName);
        await searchResponse;
        await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

        const columnRow = page.locator(`[data-row-key="${columnName}"]`);
        await expect(columnRow).toBeVisible();

        const newDescription = `Test description for ${columnName} column`;
        
        await describeEntity({
          page,
          rowSelector: 'data-row-key',
          fqn: columnName,
          description: newDescription,
          isCustomProperty: false,
        });

        // Verify description was added
        const descriptionCell = columnRow.locator('[data-testid="description"]');
        await expect(descriptionCell).toContainText(newDescription);
      });
    }

    // Test adding description to columns with ENTITY_FIELD keywords
    for (const columnName of ['description', 'owner', 'tags']) {
      await test.step(`Add description to column "${columnName}" (ENTITY_FIELD keyword)`, async () => {
        const searchResponse = page.waitForResponse(
          `/api/v1/tables/name/*/columns/search?q=${columnName}&**`
        );
        await page.getByTestId('searchbar').fill(columnName);
        await searchResponse;
        await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

        const columnRow = page.locator(`[data-row-key="${columnName}"]`);
        await expect(columnRow).toBeVisible();

        const newDescription = `Test description for ${columnName} column`;
        
        await describeEntity({
          page,
          rowSelector: 'data-row-key',
          fqn: columnName,
          description: newDescription,
          isCustomProperty: false,
        });

        // Verify description was added
        const descriptionCell = columnRow.locator('[data-testid="description"]');
        await expect(descriptionCell).toContainText(newDescription);
      });
    }
  });

  test('Should allow adding tags to columns with reserved keyword names', async ({
    page,
  }) => {
    await test.step('Navigate to table entity page', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    });

    await test.step('Add tag to column with ENTITY_TYPE keyword name', async () => {
      const columnName = 'chart';
      
      const searchResponse = page.waitForResponse(
        `/api/v1/tables/name/*/columns/search?q=${columnName}&**`
      );
      await page.getByTestId('searchbar').fill(columnName);
      await searchResponse;
      await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

      const columnRow = page.locator(`[data-row-key="${columnName}"]`);
      await expect(columnRow).toBeVisible();

      // Click on tags icon/button for the column
      const tagsButton = columnRow.locator('[data-testid="tags-container"]');
      await tagsButton.click();

      // Wait for tag selector
      await page.waitForSelector('[data-testid="tag-selector"]');

      // Add a PII tag
      await page.getByTestId('tag-selector').click();
      await page.waitForSelector('[data-testid="tag-PII.Sensitive"]');
      await page.getByTestId('tag-PII.Sensitive').click();
      await page.getByTestId('saveAssociatedTag').click();

      // Verify tag was added
      await expect(columnRow.locator('[data-testid="tags-container"]')).toContainText('Sensitive');
    });

    await test.step('Add tag to column with ENTITY_FIELD keyword name', async () => {
      const columnName = 'name';
      
      const searchResponse = page.waitForResponse(
        `/api/v1/tables/name/*/columns/search?q=${columnName}&**`
      );
      await page.getByTestId('searchbar').fill(columnName);
      await searchResponse;
      await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

      const columnRow = page.locator(`[data-row-key="${columnName}"]`);
      await expect(columnRow).toBeVisible();

      // Click on tags icon/button for the column
      const tagsButton = columnRow.locator('[data-testid="tags-container"]');
      await tagsButton.click();

      // Wait for tag selector
      await page.waitForSelector('[data-testid="tag-selector"]');

      // Add a PII tag
      await page.getByTestId('tag-selector').click();
      await page.waitForSelector('[data-testid="tag-PII.NonSensitive"]');
      await page.getByTestId('tag-PII.NonSensitive').click();
      await page.getByTestId('saveAssociatedTag').click();

      // Verify tag was added
      await expect(columnRow.locator('[data-testid="tags-container"]')).toContainText('NonSensitive');
    });
  });

  test('Should handle entity links correctly when creating tasks/annotations for reserved keyword columns', async ({
    page,
  }) => {
    await test.step('Navigate to table entity page', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    });

    await test.step('Request description for column with ENTITY_TYPE keyword', async () => {
      const columnName = 'role';
      
      const searchResponse = page.waitForResponse(
        `/api/v1/tables/name/*/columns/search?q=${columnName}&**`
      );
      await page.getByTestId('searchbar').fill(columnName);
      await searchResponse;
      await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

      const columnRow = page.locator(`[data-row-key="${columnName}"]`);
      await expect(columnRow).toBeVisible();

      // Open description editor/request
      const descriptionCell = columnRow.locator('[data-testid="description"]');
      await descriptionCell.hover();
      
      // Look for request description button
      const requestDescriptionBtn = columnRow.locator('[data-testid="request-description"]');
      if (await requestDescriptionBtn.isVisible()) {
        await requestDescriptionBtn.click();
        
        // Fill in task details
        await page.waitForSelector('[data-testid="task-title"]');
        await page.getByTestId('task-title').fill(`Request description for ${columnName} column`);
        
        // Submit task - the entity link should be properly formed with the reserved keyword
        await page.getByTestId('submit-task').click();
        
        // Verify task was created (it would fail if entity link parsing was broken)
        await page.waitForSelector('[data-testid="task-feed-card"]');
      }
    });
  });

  test('Should search and filter columns with reserved keyword names correctly', async ({
    page,
  }) => {
    await test.step('Navigate to table entity page', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    });

    // Test searching for each reserved keyword column
    const testColumns = ['topic', 'user', 'database', 'description', 'owner', 'tags'];
    
    for (const columnName of testColumns) {
      await test.step(`Search for column "${columnName}"`, async () => {
        const searchResponse = page.waitForResponse(
          `/api/v1/tables/name/*/columns/search?q=${columnName}&**`
        );
        await page.getByTestId('searchbar').fill(columnName);
        await searchResponse;
        await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

        const columnRow = page.locator(`[data-row-key="${columnName}"]`);
        await expect(columnRow).toBeVisible();

        // Clear search
        await page.getByTestId('searchbar').clear();
        await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });
      });
    }
  });
});
