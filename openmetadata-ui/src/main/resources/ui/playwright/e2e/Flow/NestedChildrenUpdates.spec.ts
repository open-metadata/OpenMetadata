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
import { expect, Page, test } from '@playwright/test';
import { nestedChildrenTestData } from '../../constant/nestedColumnUpdates';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  assignTagToChildren,
  removeTagsFromChildren,
  updateDescriptionForChildren,
  updateDisplayNameForEntityChildren,
} from '../../utils/entity';
import { getNestedColumnDetails } from '../../utils/nestedColumnUpdatesUtils';

test.use({ storageState: 'playwright/.auth/admin.json' });

for (const [
  entityType,
  { CreationClass, tabSelector, supportDisplayNameUpdate },
] of Object.entries(nestedChildrenTestData)) {
  test.describe(entityType, () => {
    const entity = new CreationClass();

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await entity.create(apiContext);
      await afterAction();
    });

    test.describe('Level 1 Nested Columns', () => {
      test.beforeEach(async ({ page }) => {
        await redirectToHomePage(page);
        const { level0Key, expand } = getNestedColumnDetails(
          entityType,
          entity
        );

        await entity.visitEntityPage(page);
        if (tabSelector) {
          await page.waitForSelector(tabSelector, { state: 'visible' });

          await page.click(tabSelector);
        }
        if (expand) {
          await expandNestedColumn(page, level0Key);
        }
      });

      test('should update nested column description immediately without page refresh', async ({
        page,
      }) => {
        const newDescription = 'Updated customer name field description';
        const { level1Key } = getNestedColumnDetails(entityType, entity);

        await expect(
          page.locator(`[data-row-key="${level1Key}"]`)
        ).toBeVisible();

        await updateDescriptionForChildren(
          page,
          newDescription,
          level1Key,
          'data-row-key',
          entity.endpoint
        );

        await expect(
          page
            .locator(`[data-row-key="${level1Key}"]`)
            .getByTestId('viewer-container')
        ).toContainText(newDescription);
      });

      test('should add and remove tags to nested column immediately without refresh', async ({
        page,
      }) => {
        const testTag = 'PII.Sensitive';
        const { level1Key } = getNestedColumnDetails(entityType, entity);

        await expandNestedColumn(page, level1Key);

        await expect(
          page.locator(`[data-row-key="${level1Key}"]`)
        ).toBeVisible();

        await assignTagToChildren({
          page,
          tag: testTag,
          rowId: level1Key,
          entityEndpoint: entity.endpoint,
        });

        await expect(
          page
            .locator(`[data-row-key="${level1Key}"]`)
            .getByTestId(`tag-${testTag}`)
        ).toBeVisible();

        await removeTagsFromChildren({
          page,
          rowId: level1Key,
          tags: [testTag],
          entityEndpoint: entity.endpoint,
        });

        await expect(
          page
            .locator(`[data-row-key="${level1Key}"]`)
            .getByTestId(`tag-${testTag}`)
        ).not.toBeVisible();
      });

      if (supportDisplayNameUpdate) {
        test('should update nested column displayName immediately without refresh', async ({
          page,
        }) => {
          const newDisplayName = 'Customer Full Name';
          const { level1Key } = getNestedColumnDetails(entityType, entity);

          await expandNestedColumn(page, level1Key);

          await expect(
            page.locator(`[data-row-key="${level1Key}"]`)
          ).toBeVisible();

          await updateDisplayNameForEntityChildren(
            page,
            {
              oldDisplayName: '',
              newDisplayName: newDisplayName,
            },
            level1Key,
            'data-row-key'
          );

          await expect(
            page
              .locator(`[data-row-key="${level1Key}"]`)
              .getByTestId('column-display-name')
          ).toHaveText(newDisplayName);
        });
      }
    });

    test.describe('Level 2 Deeply Nested Columns', () => {
      test.beforeEach(async ({ page }) => {
        await redirectToHomePage(page);
        const { level0Key, level1Key, expand } = getNestedColumnDetails(
          entityType,
          entity
        );

        await entity.visitEntityPage(page);
        if (tabSelector) {
          await page.waitForSelector(tabSelector, { state: 'visible' });

          await page.click(tabSelector);
        }
        if (expand) {
          await expandNestedColumn(page, level0Key);
          await expandNestedColumn(page, level1Key);
        }
      });

      test('should update nested column description immediately without page refresh', async ({
        page,
      }) => {
        const newDescription = 'Updated street address description';
        const { level2Key } = getNestedColumnDetails(entityType, entity);

        await expect(
          page.locator(`[data-row-key="${level2Key}"]`)
        ).toBeVisible();

        await updateDescriptionForChildren(
          page,
          newDescription,
          level2Key,
          'data-row-key',
          entity.endpoint
        );

        await expect(
          page
            .locator(`[data-row-key="${level2Key}"]`)
            .getByTestId('viewer-container')
        ).toContainText(newDescription);
      });

      test('should add and remove tags to nested column immediately without refresh', async ({
        page,
      }) => {
        const testTag = 'PII.Sensitive';
        const { level2Key } = getNestedColumnDetails(entityType, entity);

        await expect(
          page.locator(`[data-row-key="${level2Key}"]`)
        ).toBeVisible();

        await assignTagToChildren({
          page,
          tag: testTag,
          rowId: level2Key,
          entityEndpoint: entity.endpoint,
        });

        await expect(
          page
            .locator(`[data-row-key="${level2Key}"]`)
            .getByTestId(`tag-${testTag}`)
        ).toBeVisible();

        await removeTagsFromChildren({
          page,
          rowId: level2Key,
          tags: [testTag],
          entityEndpoint: entity.endpoint,
        });

        await expect(
          page
            .locator(`[data-row-key="${level2Key}"]`)
            .getByTestId(`tag-${testTag}`)
        ).not.toBeVisible();
      });

      if (supportDisplayNameUpdate) {
        test('should update nested column displayName immediately without refresh', async ({
          page,
        }) => {
          const newDisplayName = 'Street Full Name';
          const { level2Key } = getNestedColumnDetails(entityType, entity);

          await expect(
            page.locator(`[data-row-key="${level2Key}"]`)
          ).toBeVisible();

          await updateDisplayNameForEntityChildren(
            page,
            {
              oldDisplayName: '',
              newDisplayName: newDisplayName,
            },
            level2Key,
            'data-row-key'
          );

          await expect(
            page
              .locator(`[data-row-key="${level2Key}"]`)
              .getByTestId('column-display-name')
          ).toHaveText(newDisplayName);
        });
      }
    });
  });
}

const expandNestedColumn = async (page: Page, nestedColumnFqn: string) => {
  await page.waitForSelector(
    `[data-row-key="${nestedColumnFqn}"] [data-testid="expand-icon"]`,
    {
      state: 'visible',
    }
  );

  await page
    .locator(`[data-row-key="${nestedColumnFqn}"] [data-testid="expand-icon"]`)
    .click();
};
