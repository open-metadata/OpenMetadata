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
import { DataTypeTopic } from '../../../src/generated/entity/data/topic';
import { TopicClass } from '../../support/entity/TopicClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  copyAndGetClipboardText,
  testCopyLinkButton,
  updateDescriptionForChildren,
  validateCopiedLinkFormat,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write'],
  },
});

const topic = new TopicClass();

test.describe('Topic entity specific tests ', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    await topic.create(apiContext);

    await afterAction();
  });

  test.afterAll('Clean up', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    await topic.delete(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Topic page should show schema tab with count', async ({ page }) => {
    await topic.visitEntityPage(page);

    await expect(page.getByRole('tab', { name: 'Schema' })).toContainText('2');
  });

  test('Copy field link button should copy the field URL to clipboard', async ({
    page,
  }) => {
    await topic.visitEntityPage(page);

    await waitForAllLoadersToDisappear(page);

    await testCopyLinkButton({
      page,
      buttonTestId: 'copy-field-link-button',
      containerTestId: 'topic-schema-fields-table',
      rowName: topic.children[0].name,
      expectedUrlPath: '/topic/',
      entityFqn: topic.entityResponseData?.['fullyQualifiedName'] ?? '',
    });
  });

  test('Copy field link should have valid URL format', async ({ page }) => {
    await topic.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('topic-schema-fields-table')).toBeVisible();

    const copyButton = page.getByTestId('copy-field-link-button').first();
    await expect(copyButton).toBeVisible();

    const clipboardText = await copyAndGetClipboardText(page, copyButton);

    const validationResult = validateCopiedLinkFormat({
      clipboardText,
      expectedEntityType: 'topic',
      entityFqn: topic.entityResponseData?.['fullyQualifiedName'] ?? '',
    });

    expect(validationResult.isValid).toBe(true);
    expect(validationResult.protocol).toMatch(/^https?:$/);
    expect(validationResult.pathname).toContain('topic');

    // Visit the copied link to verify it opens the side panel
    await page.goto(clipboardText, { waitUntil: 'domcontentloaded' });

    // Verify side panel is open
    const sidePanel = page.locator('.column-detail-panel');
    await expect(sidePanel).toBeVisible();

    // Close side panel
    await page.getByTestId('close-button').click();
    await expect(sidePanel).not.toBeVisible();

    // Verify URL does not contain the column part
    await expect(page).toHaveURL(
      new RegExp(`/topic/${topic.entityResponseData?.['fullyQualifiedName']}$`)
    );
  });

  test('Copy nested field link should include full hierarchical path', async ({
    page,
  }) => {
    await topic.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('topic-schema-fields-table')).toBeVisible();

    const schemaTable = page.getByTestId('topic-schema-fields-table');
    const parentField =
      topic.entityResponseData?.messageSchema?.schemaFields?.[0];
    const nestedField = parentField?.children?.find(
      (field) => field.name === 'age'
    );
    const nestedFqn = nestedField?.fullyQualifiedName ?? '';
    const nestedRow = schemaTable.locator(`[data-row-key="${nestedFqn}"]`);

    // Small schemas auto-expand every row once loaded (TopicSchema), so clicking
    // the expand icon races that effect and can collapse the rows instead. Wait
    // for the auto-expanded nested row and copy from inside it.
    await expect(nestedRow).toBeVisible();

    const nestedCopyButton = nestedRow.getByTestId('copy-field-link-button');
    await expect(nestedCopyButton).toBeVisible();

    const clipboardText = await copyAndGetClipboardText(page, nestedCopyButton);

    expect(clipboardText).toContain('/topic/');
    expect(clipboardText).toContain(nestedFqn);

    await page.goto(clipboardText, { waitUntil: 'domcontentloaded' });

    // Verify side panel is open - wait for it to appear with a longer timeout
    const sidePanel = page.locator('.column-detail-panel');
    await expect(sidePanel).toBeVisible({ timeout: 10000 });

    // Close side panel
    await page.getByTestId('close-button').click();
    await expect(sidePanel).not.toBeVisible();

    // Verify URL does not contain the column part
    await expect(page).toHaveURL(
      new RegExp(`/topic/${topic.entityResponseData?.['fullyQualifiedName']}$`)
    );
  });
});

test.describe('Topic schema fields server-side pagination', () => {
  const pagedTopic = new TopicClass();
  const fieldName = (index: number) =>
    `paged_field_${String(index).padStart(2, '0')}`;

  test.beforeAll(
    'Create a topic with more fields than one page',
    async ({ browser }) => {
      const { afterAction, apiContext } = await createNewPage(browser);

      pagedTopic.entity.messageSchema.schemaFields = Array.from(
        { length: 20 },
        (_, index) => ({
          name: fieldName(index + 1),
          dataType: DataTypeTopic.String,
          tags: [],
        })
      );
      await pagedTopic.create(apiContext);

      await afterAction();
    }
  );

  test.afterAll('Clean up', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    await pagedTopic.delete(apiContext);

    await afterAction();
  });

  test('pages, edits and searches schema fields through the server', async ({
    page,
  }) => {
    const topicFqn = pagedTopic.entityResponseData.fullyQualifiedName ?? '';
    const schemaTable = page.getByTestId('topic-schema-fields-table');
    const fieldRow = (index: number) =>
      schemaTable.locator(`[data-row-key="${topicFqn}.${fieldName(index)}"]`);

    await page.goto(`/topic/${topicFqn}?pageSize=15`);
    await expect(schemaTable).toBeVisible();
    await waitForAllLoadersToDisappear(page);

    await expect(fieldRow(1)).toBeVisible();
    await expect(fieldRow(16)).not.toBeVisible();

    await test.step('Next page loads the remaining fields', async () => {
      const secondPage = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/v1/topics/name/`) &&
          response.url().includes('/columns?') &&
          response.url().includes('offset=15')
      );
      await page.getByTestId('next').click();
      await secondPage;

      await expect(fieldRow(16)).toBeVisible();
      await expect(fieldRow(1)).not.toBeVisible();
    });

    await test.step('A field on page two keeps its edit after reload', async () => {
      const description = `Paged field description ${pagedTopic.entity.name}`;
      await updateDescriptionForChildren(
        page,
        description,
        `${topicFqn}.${fieldName(17)}`,
        'data-row-key',
        'topics'
      );

      await page.reload();
      await expect(fieldRow(17)).toContainText(description);
    });

    await test.step('Search finds a field on another page', async () => {
      const searchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/columns/search') &&
          response.url().includes(fieldName(3))
      );
      await page.getByTestId('searchbar').fill(fieldName(3));
      await searchResponse;

      await expect(fieldRow(3)).toBeVisible();
      await expect(fieldRow(17)).not.toBeVisible();
    });
  });
});
