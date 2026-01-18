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
  uuid,
} from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await settingClick(page, GlobalSettingOptions.LEARNING_RESOURCES);
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  // Wait for the table to be fully loaded
  await page.waitForSelector('.ant-table-tbody');
});

// Helper function to select an option from Ant Design dropdown
async function selectDropdownOption(page: import('@playwright/test').Page, optionText: string) {
  await page.locator('.ant-select-item-option').filter({ hasText: optionText }).first().click();
}

// Helper function to wait for toast notification
async function waitForToast(page: import('@playwright/test').Page, pattern: RegExp) {
  // Wait for the Ant Design message or alert
  const toastLocator = page.locator('.ant-message-notice-content, [data-testid="alert-bar"]');
  await expect(toastLocator.filter({ hasText: pattern })).toBeVisible({ timeout: 10000 });
}

// Helper function to search for a resource by name
async function searchResource(page: import('@playwright/test').Page, searchText: string) {
  await page.locator('.search-input input').fill(searchText);
  // Wait for the table to update
  await page.waitForTimeout(500);
}

test.describe('Learning Resources Admin Page', () => {
  test('should display learning resources page', async ({ page }) => {
    await expect(page.getByTestId('learning-resources-page')).toBeVisible();
    await expect(page.getByTestId('page-title')).toContainText('Learning Resource');
    await expect(page.getByTestId('create-resource')).toBeVisible();
  });

  test('should open and close add resource drawer', async ({ page }) => {
    await test.step('Open add resource drawer', async () => {
      await page.getByTestId('create-resource').click();
      await expect(page.locator('.drawer-title')).toContainText('Add Resource');
    });

    await test.step('Close drawer', async () => {
      await page.locator('.drawer-close').click();
      await expect(page.locator('.drawer-title')).not.toBeVisible();
    });
  });

  test('should validate required fields', async ({ page }) => {
    await page.getByTestId('create-resource').click();
    await expect(page.locator('.drawer-title')).toBeVisible();

    // Try to submit without filling required fields
    await page.getByTestId('save-resource').click();

    // Expect validation errors to appear
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();

    // Close drawer
    await page.locator('.drawer-close').click();
  });

  test('should edit an existing learning resource', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Edit_Resource_${uniqueId}`,
      displayName: `PW Edit Resource ${uniqueId}`,
      description: 'Resource to be edited',
    });

    await resource.create(apiContext);

    // Reload to get fresh data after creating resource
    await page.reload();
    await page.waitForSelector('.ant-table-tbody');

    // Search for the resource to find it
    await searchResource(page, uniqueId);
    await expect(page.getByText(resource.data.displayName ?? '')).toBeVisible({ timeout: 10000 });

    await test.step('Click edit button and verify drawer opens', async () => {
      await page.getByTestId(`edit-${resource.data.name}`).click();
      await expect(page.locator('.drawer-title')).toContainText('Edit Resource');
      // Verify the form is populated with resource data
      await expect(page.locator('#name')).toHaveValue(resource.data.name);
    });

    await test.step('Close the drawer', async () => {
      await page.locator('.drawer-close').click();
      await expect(page.locator('.drawer-title')).not.toBeVisible();
    });

    await resource.delete(apiContext);
    await afterAction();
  });

  test('should delete a learning resource', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Delete_Resource_${uniqueId}`,
      displayName: `PW Delete Resource ${uniqueId}`,
    });

    await resource.create(apiContext);

    // Reload to get fresh data after creating resource
    await page.reload();
    await page.waitForSelector('.ant-table-tbody');

    // Search for the resource to find it
    await searchResource(page, uniqueId);
    await expect(page.getByText(resource.data.displayName ?? '')).toBeVisible({ timeout: 10000 });

    await test.step('Click delete button and confirm', async () => {
      await page.getByTestId(`delete-${resource.data.name}`).click();
      // Wait for the confirmation modal to appear
      await expect(page.locator('.ant-modal-confirm')).toBeVisible({ timeout: 5000 });
      // Click the OK/Delete button in the modal
      await page.locator('.ant-modal-confirm-btns button').filter({ hasText: /delete|ok/i }).click();
    });

    await test.step('Verify resource is removed from list', async () => {
      // Wait for modal to close and table to update
      await expect(page.locator('.ant-modal-confirm')).not.toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(500);
      await expect(page.getByText(resource.data.displayName ?? '')).not.toBeVisible();
    });

    await afterAction();
  });

  test('should preview a learning resource by clicking on name', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Preview_Resource_${uniqueId}`,
      displayName: `PW Preview Resource ${uniqueId}`,
      source: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        provider: 'YouTube',
      },
    });

    await resource.create(apiContext);

    // Reload to get fresh data after creating resource
    await page.reload();
    await page.waitForSelector('.ant-table-tbody');

    // Search for the resource to find it
    await searchResource(page, uniqueId);
    await expect(page.getByText(resource.data.displayName ?? '')).toBeVisible({ timeout: 10000 });

    await test.step('Click on resource name to preview', async () => {
      await page.getByText(resource.data.displayName ?? '').click();
    });

    await test.step('Verify preview modal opens', async () => {
      await expect(page.locator('.ant-modal')).toBeVisible();
    });

    await test.step('Close preview modal', async () => {
      // Close button is in the modal header with class 'close-button'
      await page.locator('.close-button').click();
      await expect(page.locator('.ant-modal')).not.toBeVisible({ timeout: 5000 });
    });

    await resource.delete(apiContext);
    await afterAction();
  });

  test('should filter resources by type', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const videoResource = new LearningResourceClass({
      name: `PW_Video_Resource_${uniqueId}`,
      displayName: `PW Video Resource ${uniqueId}`,
      resourceType: 'Video',
    });

    await videoResource.create(apiContext);

    // Reload to get fresh data
    await page.reload();
    await page.waitForSelector('.ant-table-tbody');

    await test.step('Filter by Video type', async () => {
      await page.locator('.filter-select').filter({ hasText: 'Type' }).click();
      await selectDropdownOption(page, 'Video');

      // Search for our specific resource
      await searchResource(page, uniqueId);
      await expect(page.getByText(`PW Video Resource ${uniqueId}`)).toBeVisible({ timeout: 10000 });
    });

    await videoResource.delete(apiContext);
    await afterAction();
  });

  test('should search resources by name', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Search_Resource_${uniqueId}`,
      displayName: `PW Search Resource ${uniqueId}`,
    });

    await resource.create(apiContext);

    // Reload to get fresh data
    await page.reload();
    await page.waitForSelector('.ant-table-tbody');

    await test.step('Search for resource', async () => {
      await searchResource(page, uniqueId);
      await expect(page.getByText(`PW Search Resource ${uniqueId}`)).toBeVisible({ timeout: 10000 });
    });

    await resource.delete(apiContext);
    await afterAction();
  });
});

test.describe('Learning Icon on Pages', () => {
  test('should display learning icon on glossary page when resources exist', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const resource = new LearningResourceClass({
      name: `PW_Glossary_Icon_Resource_${uuid()}`,
      displayName: `PW Glossary Icon Resource`,
      contexts: [{ pageId: 'glossary' }],
      status: 'Active',
    });

    await resource.create(apiContext);

    await page.goto('/glossary');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    const learningIcon = page.locator('[data-testid="learning-icon"]');
    await expect(learningIcon).toBeVisible({ timeout: 10000 });

    await resource.delete(apiContext);
    await afterAction();
  });

  test('should open learning drawer when icon is clicked', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const resource = new LearningResourceClass({
      name: `PW_Glossary_Drawer_Resource_${uuid()}`,
      displayName: `PW Glossary Drawer Resource`,
      contexts: [{ pageId: 'glossary' }],
      status: 'Active',
    });

    await resource.create(apiContext);

    await page.goto('/glossary');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await test.step('Click learning icon', async () => {
      const learningIcon = page.locator('[data-testid="learning-icon"]');
      await expect(learningIcon).toBeVisible({ timeout: 10000 });
      await learningIcon.click();
    });

    await test.step('Verify drawer opens with resources', async () => {
      await expect(page.locator('.learning-drawer')).toBeVisible();
    });

    await test.step('Close drawer', async () => {
      await page.keyboard.press('Escape');
    });

    await resource.delete(apiContext);
    await afterAction();
  });
});
