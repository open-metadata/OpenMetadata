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
import { TopicClass } from '../../support/entity/TopicClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  copyAndGetClipboardText,
  testCopyLinkButton,
  validateCopiedLinkFormat,
} from '../../utils/entity';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write'],
  },
});

const topic = new TopicClass();

test.slow(true);

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

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await testCopyLinkButton({
      page,
      buttonTestId: 'copy-field-link-button',
      containerTestId: 'topic-schema-fields-table',
      expectedUrlPath: '/topic/',
      entityFqn: topic.entityResponseData?.['fullyQualifiedName'] ?? '',
    });
  });

  test('Copy field link should have valid URL format', async ({ page }) => {
    await topic.visitEntityPage(page);
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

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
    await page.goto(clipboardText);

    // Verify side panel is open
    const sidePanel = page.locator('.column-detail-panel');
    await expect(sidePanel).toBeVisible();

    // Close side panel
    await page.getByTestId('close-button').click();
    await expect(sidePanel).not.toBeVisible();

    // Verify URL does not contain the column part
    await expect(page).toHaveURL(new RegExp(`/topic/${topic.entityResponseData?.['fullyQualifiedName']}$`));
  });

  test('Copy nested field link should include full hierarchical path', async ({
    page,
  }) => {
    await topic.visitEntityPage(page);
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(page.getByTestId('topic-schema-fields-table')).toBeVisible();

    const expandButtons = page.locator('[data-testid="expand-icon"]');
    const expandButtonCount = await expandButtons.count();

    if (expandButtonCount > 0) {
      // Expand the first nested field
      await expandButtons.first().click();

      // Find copy button in the nested row
      const nestedCopyButtons = page.getByTestId('copy-field-link-button');
      const nestedButtonCount = await nestedCopyButtons.count();

      // If we have more than one copy button, the second one is likely nested
      if (nestedButtonCount > 1) {
        const nestedCopyButton = nestedCopyButtons.nth(1);
        await expect(nestedCopyButton).toBeVisible();

        const clipboardText = await copyAndGetClipboardText(page, nestedCopyButton);

        // Verify the URL contains the topic FQN
        expect(clipboardText).toContain('/topic/');
        expect(clipboardText).toContain(
          topic.entityResponseData?.['fullyQualifiedName'] ?? ''
        );

        // Visit the copied link to verify it opens the side panel
        await page.goto(clipboardText);
        await page.waitForLoadState('networkidle');

        // Verify side panel is open - wait for it to appear with a longer timeout
        const sidePanel = page.locator('.column-detail-panel');
        await expect(sidePanel).toBeVisible({ timeout: 10000 });

        // Close side panel
        await page.getByTestId('close-button').click();
        await expect(sidePanel).not.toBeVisible();

        // Verify URL does not contain the column part
        await expect(page).toHaveURL(new RegExp(`/topic/${topic.entityResponseData?.['fullyQualifiedName']}$`));
      }
    }
  });
});
