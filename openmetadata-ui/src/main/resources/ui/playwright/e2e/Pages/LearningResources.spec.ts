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
import { expect, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { LearningResourceClass } from '../../support/learning/LearningResourceClass';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

const resourceName = `PW_LearningResource_${uuid()}`;
const resourceDisplayName = `PW Learning Resource ${uuid()}`;
const resourceDescription = 'Playwright test learning resource';
const updatedDescription = 'Updated learning resource description';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await settingClick(page, GlobalSettingOptions.LEARNING_RESOURCES);
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
});

test.describe('Learning Resources Admin Page', () => {
  test('should display learning resources page', async ({ page }) => {
    await expect(page.locator('h3')).toContainText('Learning Resources');
    await expect(page.locator('[data-testid="create-resource"]')).toBeVisible();
  });

  test('should add a new learning resource', async ({ page }) => {
    test.slow(true);

    await test.step('Open add resource drawer', async () => {
      await page.locator('[data-testid="create-resource"]').click();

      await expect(
        page.locator('.ant-drawer-title')
      ).toContainText('Add Learning Resource');
    });

    await test.step('Fill in resource details', async () => {
      // Fill name
      await page
        .locator('input[placeholder="e.g., Intro_GlossaryBasics"]')
        .fill(resourceName);

      // Fill display name
      await page
        .locator('input[placeholder="e.g., Glossary Basics"]')
        .fill(resourceDisplayName);

      // Fill description
      await page.locator('textarea').fill(resourceDescription);

      // Select resource type
      await page
        .locator('.ant-form-item')
        .filter({ hasText: 'Type' })
        .locator('.ant-select-selector')
        .click();
      await page.locator('[title="Video"]').click();

      // Select categories
      await page
        .locator('.ant-form-item')
        .filter({ hasText: 'Categories' })
        .locator('.ant-select-selector')
        .click();
      await page.locator('[title="Discovery"]').click();

      // Click outside to close dropdown
      await page.locator('.ant-drawer-body').click();

      // Fill source URL
      await page
        .locator('input[placeholder="https://..."]')
        .fill('https://www.youtube.com/watch?v=test123');

      // Fill provider
      await page
        .locator(
          'input[placeholder="e.g., OpenMetadata, Collate, YouTube"]'
        )
        .fill('YouTube');

      // Add context
      await page.locator('button:has-text("Add Context")').click();

      // Select page ID for context
      await page
        .locator('.ant-form-item')
        .filter({ hasText: 'Page ID' })
        .first()
        .locator('.ant-select-selector')
        .click();
      await page.locator('[title="glossary"]').click();
    });

    await test.step('Submit the form', async () => {
      await page.locator('[data-testid="save-resource"]').click();

      await toastNotification(page, 'Learning Resource created successfully');
    });

    await test.step('Verify resource appears in list', async () => {
      await expect(
        page.locator(`text=${resourceDisplayName}`)
      ).toBeVisible();
    });
  });

  test('should edit an existing learning resource', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const resource = new LearningResourceClass({
      name: `PW_Edit_Resource_${uuid()}`,
      displayName: `PW Edit Resource ${uuid()}`,
      description: 'Resource to be edited',
    });

    await resource.create(apiContext);

    await page.reload();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await test.step('Click edit button', async () => {
      await page
        .locator(`[data-testid="edit-${resource.data.name}"]`)
        .click();

      await expect(
        page.locator('.ant-drawer-title')
      ).toContainText('Edit Learning Resource');
    });

    await test.step('Update description', async () => {
      await page.locator('textarea').fill(updatedDescription);
    });

    await test.step('Submit the form', async () => {
      await page.locator('[data-testid="save-resource"]').click();

      await toastNotification(page, 'Learning Resource updated successfully');
    });

    // Cleanup
    await resource.delete(apiContext);
    await afterAction();
  });

  test('should delete a learning resource', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const resource = new LearningResourceClass({
      name: `PW_Delete_Resource_${uuid()}`,
      displayName: `PW Delete Resource ${uuid()}`,
    });

    await resource.create(apiContext);

    await page.reload();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await test.step('Click delete button', async () => {
      await page
        .locator(`[data-testid="delete-${resource.data.name}"]`)
        .click();
    });

    await test.step('Confirm deletion', async () => {
      await page.locator('.ant-modal-confirm-btns .ant-btn-primary').click();

      await toastNotification(page, 'Learning Resource deleted successfully');
    });

    await test.step('Verify resource is removed from list', async () => {
      await expect(
        page.locator(`text=${resource.data.displayName}`)
      ).not.toBeVisible();
    });

    await afterAction();
  });

  test('should preview a learning resource', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const resource = new LearningResourceClass({
      name: `PW_Preview_Resource_${uuid()}`,
      displayName: `PW Preview Resource ${uuid()}`,
      source: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        provider: 'YouTube',
      },
    });

    await resource.create(apiContext);

    await page.reload();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await test.step('Click preview button', async () => {
      await page
        .locator(`[data-testid="preview-${resource.data.name}"]`)
        .click();
    });

    await test.step('Verify preview modal opens', async () => {
      await expect(page.locator('.ant-modal')).toBeVisible();
      await expect(
        page.locator('.ant-modal-title')
      ).toContainText(resource.data.displayName ?? '');
    });

    await test.step('Close preview modal', async () => {
      await page.locator('.ant-modal-close').click();
      await expect(page.locator('.ant-modal')).not.toBeVisible();
    });

    // Cleanup
    await resource.delete(apiContext);
    await afterAction();
  });

  test('should validate required fields', async ({ page }) => {
    await test.step('Open add resource drawer', async () => {
      await page.locator('[data-testid="create-resource"]').click();
    });

    await test.step('Try to submit without filling required fields', async () => {
      await page.locator('[data-testid="save-resource"]').click();

      // Should show validation errors
      await expect(page.locator('.ant-form-item-explain-error')).toBeVisible();
    });
  });
});

test.describe('Learning Icon on Pages', () => {
  test('should display learning icon on glossary page', async ({ page }) => {
    await page.goto('/glossary');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Look for the learning icon in the page header
    const learningIcon = page.locator('[data-testid="learning-icon-glossary"]');

    // Icon should be visible if there are learning resources for this context
    await expect(learningIcon).toBeVisible();
  });

  test('should open learning drawer when icon is clicked', async ({ page }) => {
    // First create a resource with glossary context
    const { apiContext, afterAction } = await getApiContext(page);
    const resource = new LearningResourceClass({
      name: `PW_Glossary_Resource_${uuid()}`,
      displayName: `PW Glossary Resource ${uuid()}`,
      contexts: [{ pageId: 'glossary' }],
    });

    await resource.create(apiContext);

    await page.goto('/glossary');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await test.step('Click learning icon', async () => {
      const learningIcon = page.locator(
        '[data-testid="learning-icon-glossary"]'
      );
      await learningIcon.click();
    });

    await test.step('Verify drawer opens with resources', async () => {
      await expect(page.locator('.ant-drawer')).toBeVisible();
      await expect(
        page.locator('.ant-drawer-title')
      ).toContainText('Learning Resources');
    });

    await test.step('Close drawer', async () => {
      await page.locator('[data-testid="close-drawer"]').click();
      await expect(page.locator('.ant-drawer')).not.toBeVisible();
    });

    // Cleanup
    await resource.delete(apiContext);
    await afterAction();
  });
});
