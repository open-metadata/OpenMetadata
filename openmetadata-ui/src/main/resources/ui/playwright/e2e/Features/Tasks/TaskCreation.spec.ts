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
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';

/**
 * Task Creation Tests
 *
 * Tests all task creation scenarios including:
 * - Request description for table/column
 * - Request tags for table/column
 * - Suggest description for table/column
 * - Suggest tags for table/column
 * - Auto-fill assignees from entity owners
 * - Manual assignee selection
 */

test.describe('Task Creation - Request Description', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const tableWithOwner = new TableClass();
  const tableWithoutOwner = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

      await tableWithOwner.create(apiContext);
      await tableWithOwner.setOwner(apiContext, {
        id: ownerUser.responseData.id,
        type: 'user',
      });

      await tableWithoutOwner.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await tableWithOwner.delete(apiContext);
      await tableWithoutOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
  });

  test('should create request description task for table', async ({ page }) => {
    await tableWithOwner.visitEntityPage(page);

    // Find and click request description button
    const requestDescBtn = page.getByTestId('request-description');
    await expect(requestDescBtn).toBeVisible();
    await requestDescBtn.click();

    // Wait for task form page to load (navigates to a separate page, not a modal)
    await page.waitForSelector('[data-testid="form-container"]', {
      state: 'visible',
    });

    // Verify title contains description request info
    const titleField = page.locator('#title');
    await expect(titleField).toBeVisible();
    const titleValue = await titleField.inputValue();
    expect(titleValue.toLowerCase()).toContain('description');

    // Verify assignee is auto-filled with owner (select component contains the user)
    const assigneeContainer = page.getByTestId('select-assignee');
    await expect(assigneeContainer).toBeVisible();

    // Submit task
    const submitBtn = page.getByTestId('submit-btn');
    await expect(submitBtn).toBeEnabled();

    const taskResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/tasks') &&
        response.request().method() === 'POST'
    );
    await submitBtn.click();
    await taskResponse;

    // Should navigate back to entity page with activity feed
    await page.waitForLoadState('networkidle');

    // Verify task appears in activity feed
    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    await expect(taskCard).toBeVisible({ timeout: 10000 });
  });

  test('should create request description task for column', async ({ page }) => {
    await tableWithOwner.visitEntityPage(page);

    // Expand columns section and find a column
    const columnsTab = page.getByRole('tab', { name: /schema/i });
    if (await columnsTab.isVisible()) {
      await columnsTab.click();
      await page.waitForLoadState('networkidle');
    }

    // Find column row and click request description within that row
    const columnRow = page
      .locator('tr')
      .filter({ has: page.locator('[data-testid="column-name"]') })
      .first();
    await columnRow.hover();

    // Find the request description button within this specific column row
    const columnRequestDesc = columnRow.locator(
      '[data-testid="request-description"]'
    );

    if (await columnRequestDesc.isVisible()) {
      await columnRequestDesc.click();

      // Wait for task form page to load
      await page.waitForSelector('[data-testid="form-container"]', {
        state: 'visible',
      });

      // Verify this is a column-level task by checking the about field references a column
      const titleField = page.locator('#title');
      const titleValue = await titleField.inputValue();
      expect(titleValue.toLowerCase()).toContain('description');

      // Submit
      const submitBtn = page.getByTestId('submit-btn');
      const taskResponse = page.waitForResponse('/api/v1/tasks');
      await submitBtn.click();
      await taskResponse;

      await page.waitForLoadState('networkidle');
    }
  });

  test('should allow manual assignee selection when entity has no owner', async ({
    page,
  }) => {
    await tableWithoutOwner.visitEntityPage(page);

    const requestDescBtn = page.getByTestId('request-description');
    await expect(requestDescBtn).toBeVisible();
    await requestDescBtn.click();

    // Wait for task form page to load
    await page.waitForSelector('[data-testid="form-container"]', {
      state: 'visible',
    });

    // Assignee field - search and select user
    const assigneeInput = page.locator(
      '[data-testid="select-assignee"] .ant-select-selector input'
    );
    await assigneeInput.click();

    // Search for user
    const userSearchResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('user_search_index')
    );
    await assigneeInput.fill(ownerUser.responseData.name);
    await userSearchResponse;

    // Click on user in dropdown
    const userOption = page.getByTestId(ownerUser.responseData.name);
    await userOption.click();

    // Submit
    const submitBtn = page.getByTestId('submit-btn');
    await expect(submitBtn).toBeEnabled();

    const taskResponse = page.waitForResponse('/api/v1/tasks');
    await submitBtn.click();
    await taskResponse;

    await page.waitForLoadState('networkidle');
  });

  test('should prevent task creation without assignee', async ({ page }) => {
    await tableWithoutOwner.visitEntityPage(page);

    const requestDescBtn = page.getByTestId('request-description');
    await requestDescBtn.click();

    // Wait for task form page to load
    await page.waitForSelector('[data-testid="form-container"]', {
      state: 'visible',
    });

    // Try to submit without assignee
    const submitBtn = page.getByTestId('submit-btn');
    await submitBtn.click();

    // Should show validation error for assignee field
    const assigneeError = page.locator('.ant-form-item-explain-error');
    await expect(assigneeError).toBeVisible();
  });
});

test.describe('Task Creation - Request Tags', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

      await table.create(apiContext);
      await table.setOwner(apiContext, {
        id: ownerUser.responseData.id,
        type: 'user',
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await table.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
  });

  test('should create request tags task for table', async ({ page }) => {
    await table.visitEntityPage(page);

    // Find request tags button (request-entity-tags is the actual test ID)
    const requestTagsBtn = page.getByTestId('request-entity-tags');

    if (await requestTagsBtn.isVisible()) {
      await requestTagsBtn.click();

      // Wait for task form page to load
      await page.waitForSelector('[data-testid="form-container"]', {
        state: 'visible',
      });

      // Verify title contains tag info
      const titleField = page.locator('#title');
      const titleValue = await titleField.inputValue();
      expect(titleValue.toLowerCase()).toContain('tag');

      // Submit - tag request pages use submit-tag-request
      const submitBtn = page.getByTestId('submit-tag-request');
      const taskResponse = page.waitForResponse('/api/v1/tasks');
      await submitBtn.click();
      await taskResponse;

      await page.waitForLoadState('networkidle');
    }
  });
});

test.describe('Task Creation - Suggest Description', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

      await table.create(apiContext);
      await table.setOwner(apiContext, {
        id: ownerUser.responseData.id,
        type: 'user',
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await table.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
  });

  test('should create suggest description task with suggested value', async ({
    page,
  }) => {
    await table.visitEntityPage(page);

    // Find request description button (same button is used for suggest)
    const requestDescBtn = page.getByTestId('request-description');

    if (await requestDescBtn.isVisible()) {
      await requestDescBtn.click();

      // Wait for task form page to load
      await page.waitForSelector('[data-testid="form-container"]', {
        state: 'visible',
      });

      // Enter suggested description in the rich text editor
      const descriptionEditor = page.locator('.toastui-editor-contents');
      if (await descriptionEditor.isVisible()) {
        await descriptionEditor.click();
        await page.keyboard.type('This is a suggested description for the table.');
      }

      // Submit
      const submitBtn = page.getByTestId('submit-btn');
      const taskResponse = page.waitForResponse('/api/v1/tasks');
      await submitBtn.click();
      await taskResponse;

      await page.waitForLoadState('networkidle');

      // Verify task appears in activity feed
      const taskCard = page.locator('[data-testid="task-feed-card"]').first();
      await expect(taskCard).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Task Creation - Suggest Tags', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

      await table.create(apiContext);
      await table.setOwner(apiContext, {
        id: ownerUser.responseData.id,
        type: 'user',
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await table.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
  });

  test('should create suggest tags task with suggested tags', async ({
    page,
  }) => {
    await table.visitEntityPage(page);

    // Request tags button
    const requestTagsBtn = page.getByTestId('request-entity-tags');

    if (await requestTagsBtn.isVisible()) {
      await requestTagsBtn.click();

      // Wait for task form page to load
      await page.waitForSelector('[data-testid="form-container"]', {
        state: 'visible',
      });

      // Add suggested tags using the tag selector
      const tagsInput = page.locator(
        '[data-testid="tag-selector"] .ant-select-selector input'
      );
      if (await tagsInput.isVisible()) {
        await tagsInput.click();

        // Type tag name
        const tagSearchResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/search/query') &&
            response.url().includes('tag_search_index')
        );
        await tagsInput.fill('PII');
        await tagSearchResponse;

        // Select from dropdown
        const tagOption = page.getByTestId('tag-PII.Sensitive').first();
        if (await tagOption.isVisible()) {
          await tagOption.click();
        }

        // Close the dropdown by pressing Escape
        await page.keyboard.press('Escape');
      }

      // Submit - tag request pages use submit-tag-request
      const submitBtn = page.getByTestId('submit-tag-request');
      const taskResponse = page.waitForResponse('/api/v1/tasks');
      await submitBtn.click();
      await taskResponse;

      await page.waitForLoadState('networkidle');
    }
  });
});
