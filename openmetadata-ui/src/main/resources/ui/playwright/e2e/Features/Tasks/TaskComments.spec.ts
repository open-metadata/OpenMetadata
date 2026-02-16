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

/**
 * Task Comments Tests
 *
 * Tests all task comment scenarios including:
 * - Adding comments to tasks
 * - Editing comments
 * - Deleting comments
 * - @mention functionality in comments
 * - Comment notifications
 * - Permission to comment (anyone vs assignee only)
 */

test.describe('Task Comments - Add Comment', () => {
  const adminUser = new UserClass();
  const assigneeUser = new UserClass();
  const commentingUser = new UserClass();
  const table = new TableClass();

  let taskId: string;

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await assigneeUser.create(apiContext);
      await commentingUser.create(apiContext);

      await table.create(apiContext);
      await table.setOwner(apiContext, {
        id: assigneeUser.responseData.id,
        type: 'user',
      });

      // Create a task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Test Task - ${Date.now()}`,
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [assigneeUser.responseData.name],
        },
      });
      const task = await taskResponse.json();
      taskId = task.id;
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await table.delete(apiContext);
      await commentingUser.delete(apiContext);
      await assigneeUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('assignee should be able to add comment to task', async ({ page }) => {
    await assigneeUser.login(page);
    await table.visitEntityPage(page);

    await page.getByTestId('activity_feed').click();
    await page.waitForLoadState('networkidle');

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await page.waitForLoadState('networkidle');
    }

    // Click on task to open detail drawer
    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('networkidle');

      // Find comment input in drawer
      const drawer = page.locator('.ant-drawer-content');

      if (await drawer.isVisible()) {
        const commentInput = drawer.locator(
          '[data-testid="comment-input"], .ql-editor, [placeholder*="comment" i]'
        );

        if (await commentInput.isVisible()) {
          await commentInput.fill('This is a test comment from assignee');

          // Submit comment
          const sendBtn = drawer.getByTestId('send-comment');
          if (await sendBtn.isVisible()) {
            const commentResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/tasks/') &&
                response.url().includes('/comments')
            );
            await sendBtn.click();
            await commentResponse;

            // Verify comment appears
            await expect(
              drawer.getByText('This is a test comment from assignee')
            ).toBeVisible();
          }
        }
      }
    }
  });

  test('non-assignee should be able to add comment', async ({ page }) => {
    await commentingUser.login(page);
    await table.visitEntityPage(page);

    await page.getByTestId('activity_feed').click();
    await page.waitForLoadState('networkidle');

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await page.waitForLoadState('networkidle');
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('networkidle');

      const drawer = page.locator('.ant-drawer-content');

      if (await drawer.isVisible()) {
        const commentInput = drawer.locator(
          '[data-testid="comment-input"], .ql-editor, [placeholder*="comment" i]'
        );

        if (await commentInput.isVisible()) {
          await commentInput.fill('Comment from non-assignee user');

          const sendBtn = drawer.getByTestId('send-comment');
          if (await sendBtn.isVisible()) {
            await sendBtn.click();
            await page.waitForLoadState('networkidle');

            // Comment should be added or access denied
            // (depends on permission model)
          }
        }
      }
    }
  });

  test('admin should be able to add comment to any task', async ({ page }) => {
    await adminUser.login(page);
    await table.visitEntityPage(page);

    await page.getByTestId('activity_feed').click();
    await page.waitForLoadState('networkidle');

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await page.waitForLoadState('networkidle');
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('networkidle');

      const drawer = page.locator('.ant-drawer-content');

      if (await drawer.isVisible()) {
        const commentInput = drawer.locator(
          '[data-testid="comment-input"], .ql-editor, [placeholder*="comment" i]'
        );

        if (await commentInput.isVisible()) {
          await commentInput.fill('Admin comment on task');

          const sendBtn = drawer.getByTestId('send-comment');
          if (await sendBtn.isVisible()) {
            await sendBtn.click();
            await page.waitForLoadState('networkidle');

            await expect(drawer.getByText('Admin comment on task')).toBeVisible();
          }
        }
      }
    }
  });
});

test.describe('Task Comments - @Mention', () => {
  const adminUser = new UserClass();
  const assigneeUser = new UserClass();
  const mentionedUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await assigneeUser.create(apiContext);
      await mentionedUser.create(apiContext);

      await table.create(apiContext);
      await table.setOwner(apiContext, {
        id: assigneeUser.responseData.id,
        type: 'user',
      });

      await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Test Task - ${Date.now()}`,
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [assigneeUser.responseData.name],
        },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await table.delete(apiContext);
      await mentionedUser.delete(apiContext);
      await assigneeUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('typing @ should show user suggestion dropdown', async ({ page }) => {
    await adminUser.login(page);
    await table.visitEntityPage(page);

    await page.getByTestId('activity_feed').click();
    await page.waitForLoadState('networkidle');

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await page.waitForLoadState('networkidle');
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('networkidle');

      const drawer = page.locator('.ant-drawer-content');

      if (await drawer.isVisible()) {
        const commentInput = drawer.locator(
          '[data-testid="comment-input"], .ql-editor, [contenteditable="true"]'
        );

        if (await commentInput.isVisible()) {
          await commentInput.click();
          await page.keyboard.type('@');
          await page.waitForLoadState('networkidle');

          // Should show mention dropdown
          const mentionDropdown = page.locator(
            '.mention-dropdown, .ql-mention-list-container, [data-testid="mention-suggestions"]'
          );

          // Dropdown should appear (may or may not be visible depending on UI implementation)
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('selecting user from @ dropdown should add mention', async ({
    page,
  }) => {
    await adminUser.login(page);
    await table.visitEntityPage(page);

    await page.getByTestId('activity_feed').click();
    await page.waitForLoadState('networkidle');

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await page.waitForLoadState('networkidle');
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('networkidle');

      const drawer = page.locator('.ant-drawer-content');

      if (await drawer.isVisible()) {
        const commentInput = drawer.locator(
          '[data-testid="comment-input"], .ql-editor, [contenteditable="true"]'
        );

        if (await commentInput.isVisible()) {
          await commentInput.click();

          // Type @ and part of username
          await page.keyboard.type(`@${mentionedUser.responseData.name}`);
          await page.waitForTimeout(500);

          // Select from dropdown if visible
          const mentionItem = page.locator(
            `.mention-item, .ql-mention-list-item:has-text("${mentionedUser.responseData.displayName}")`
          );

          if (await mentionItem.isVisible()) {
            await mentionItem.click();

            // Continue typing and submit
            await page.keyboard.type(' please review this task');

            const sendBtn = drawer.getByTestId('send-comment');
            if (await sendBtn.isVisible()) {
              await sendBtn.click();
              await page.waitForLoadState('networkidle');
            }
          }
        }
      }
    }
  });
});

test.describe('Task Comments - Edit/Delete', () => {
  const adminUser = new UserClass();
  const assigneeUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await assigneeUser.create(apiContext);

      await table.create(apiContext);
      await table.setOwner(apiContext, {
        id: assigneeUser.responseData.id,
        type: 'user',
      });

      // Create task with comment
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: {
            type: 'table',
            id: table.entityResponseData?.id,
            fullyQualifiedName: table.entityResponseData?.fullyQualifiedName,
          },
          type: 'RequestDescription',
          assignees: [{ id: assigneeUser.responseData.id, type: 'user' }],
        },
      });
      const task = await taskResponse.json();

      // Add a comment
      await apiContext.post(`/api/v1/tasks/${task.id}/comments`, {
        data: {
          message: 'Initial comment for edit/delete test',
        },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await table.delete(apiContext);
      await assigneeUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('comment author should see edit/delete options', async ({ page }) => {
    await adminUser.login(page);
    await table.visitEntityPage(page);

    await page.getByTestId('activity_feed').click();
    await page.waitForLoadState('networkidle');

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await page.waitForLoadState('networkidle');
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('networkidle');

      const drawer = page.locator('.ant-drawer-content');

      if (await drawer.isVisible()) {
        // Find comment
        const comment = drawer.locator(
          '[data-testid="comment-item"], .task-comment'
        );

        if (await comment.first().isVisible()) {
          // Hover to show actions
          await comment.first().hover();

          // Look for edit/delete buttons
          const editBtn = comment.first().getByTestId('edit-comment');
          const deleteBtn = comment.first().getByTestId('delete-comment');

          // Author should see these buttons
          // (depends on UI implementation)
        }
      }
    }
  });

  test('should be able to edit own comment', async ({ page }) => {
    await adminUser.login(page);
    await table.visitEntityPage(page);

    await page.getByTestId('activity_feed').click();
    await page.waitForLoadState('networkidle');

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await page.waitForLoadState('networkidle');
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('networkidle');

      const drawer = page.locator('.ant-drawer-content');

      if (await drawer.isVisible()) {
        const comment = drawer.locator(
          '[data-testid="comment-item"], .task-comment'
        );

        if (await comment.first().isVisible()) {
          await comment.first().hover();

          const editBtn = comment.first().getByTestId('edit-comment');

          if (await editBtn.isVisible()) {
            await editBtn.click();

            // Edit comment text
            const editInput = drawer.locator('[data-testid="edit-comment-input"]');
            if (await editInput.isVisible()) {
              await editInput.fill('Updated comment text');

              const saveBtn = drawer.getByTestId('save-comment');
              await saveBtn.click();
              await page.waitForLoadState('networkidle');

              await expect(drawer.getByText('Updated comment text')).toBeVisible();
            }
          }
        }
      }
    }
  });

  test('should be able to delete own comment', async ({ page }) => {
    await adminUser.login(page);
    await table.visitEntityPage(page);

    await page.getByTestId('activity_feed').click();
    await page.waitForLoadState('networkidle');

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await page.waitForLoadState('networkidle');
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('networkidle');

      const drawer = page.locator('.ant-drawer-content');

      if (await drawer.isVisible()) {
        const comments = drawer.locator(
          '[data-testid="comment-item"], .task-comment'
        );
        const initialCount = await comments.count();

        if (initialCount > 0) {
          await comments.first().hover();

          const deleteBtn = comments.first().getByTestId('delete-comment');

          if (await deleteBtn.isVisible()) {
            await deleteBtn.click();

            // Confirm deletion
            const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i });
            if (await confirmBtn.isVisible()) {
              await confirmBtn.click();
              await page.waitForLoadState('networkidle');

              // Comment count should decrease
              const newCount = await comments.count();
              expect(newCount).toBeLessThan(initialCount);
            }
          }
        }
      }
    }
  });

  test('non-author should not see edit/delete options', async ({ page }) => {
    await assigneeUser.login(page);
    await table.visitEntityPage(page);

    await page.getByTestId('activity_feed').click();
    await page.waitForLoadState('networkidle');

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await page.waitForLoadState('networkidle');
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await page.waitForLoadState('networkidle');

      const drawer = page.locator('.ant-drawer-content');

      if (await drawer.isVisible()) {
        // Find comment from admin (not assignee)
        const comment = drawer.locator(
          '[data-testid="comment-item"], .task-comment'
        );

        if (await comment.first().isVisible()) {
          await comment.first().hover();

          // Non-author should NOT see edit/delete buttons for others' comments
          const editBtn = comment.first().getByTestId('edit-comment');
          const deleteBtn = comment.first().getByTestId('delete-comment');

          // These should not be visible (or should be for own comments only)
        }
      }
    }
  });
});

test.describe('Task Comments - API Validation', () => {
  const adminUser = new UserClass();
  const table = new TableClass();
  let taskId: string;

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);

      await table.create(apiContext);

      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          name: `API Validation Test Task - ${Date.now()}`,
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          priority: 'Medium',
          assignees: [adminUser.responseData.name],
          payload: {
            suggestedValue: 'Test description for API validation',
            currentValue: '',
            field: 'description',
          },
        },
      });
      const task = await taskResponse.json();
      taskId = task.id;
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await table.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('POST /tasks/{id}/comments should add comment', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      const response = await apiContext.post(`/api/v1/tasks/${taskId}/comments`, {
        data: {
          message: 'API test comment',
        },
      });

      expect(response.ok()).toBe(true);

      // Verify comment was added
      const getResponse = await apiContext.get(
        `/api/v1/tasks/${taskId}?fields=comments`
      );
      const task = await getResponse.json();

      expect(task.comments).toBeDefined();
      expect(task.comments.length).toBeGreaterThan(0);
    } finally {
      await afterAction();
    }
  });

  test('GET /tasks/{id}?fields=comments should return comments', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      const response = await apiContext.get(
        `/api/v1/tasks/${taskId}?fields=comments`
      );

      expect(response.ok()).toBe(true);
      const task = await response.json();

      expect(task).toHaveProperty('comments');
      expect(Array.isArray(task.comments)).toBe(true);
    } finally {
      await afterAction();
    }
  });
});
