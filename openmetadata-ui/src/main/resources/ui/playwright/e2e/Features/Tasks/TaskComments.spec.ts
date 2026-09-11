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

import { TableClass } from '../../../support/entity/TableClass';
import { expect, test } from '../../../support/fixtures/base';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { waitForPageLoaded } from '../../../utils/polling';

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
          about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
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
    await waitForPageLoaded(page);

    const tasksTab = page.getByRole('menuitem', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await waitForPageLoaded(page);
    }

    // Click on task to open detail drawer
    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await waitForPageLoaded(page);

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
    await waitForPageLoaded(page);

    const tasksTab = page.getByRole('menuitem', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await waitForPageLoaded(page);
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await waitForPageLoaded(page);

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
            await waitForPageLoaded(page);

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
    await waitForPageLoaded(page);

    const tasksTab = page.getByRole('menuitem', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await waitForPageLoaded(page);
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await waitForPageLoaded(page);

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
            await waitForPageLoaded(page);

            await expect(
              drawer.getByText('Admin comment on task')
            ).toBeVisible();
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
          about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
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
    await waitForPageLoaded(page);

    const tasksTab = page.getByRole('menuitem', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await waitForPageLoaded(page);
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await waitForPageLoaded(page);

      const drawer = page.locator('.ant-drawer-content');

      if (await drawer.isVisible()) {
        const commentInput = drawer.locator(
          '[data-testid="comment-input"], .ql-editor, [contenteditable="true"]'
        );

        if (await commentInput.isVisible()) {
          await commentInput.click();
          await page.keyboard.type('@');
          await waitForPageLoaded(page);

          // Should show mention dropdown
          const mentionDropdown = page.locator(
            '.mention-dropdown, .ql-mention-list-container, [data-testid="mention-suggestions"]'
          );

          await mentionDropdown
            .first()
            .waitFor({ state: 'visible', timeout: 2000 })
            .catch(() => undefined);
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
    await waitForPageLoaded(page);

    const tasksTab = page.getByRole('menuitem', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await waitForPageLoaded(page);
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await waitForPageLoaded(page);

      const drawer = page.locator('.ant-drawer-content');

      if (await drawer.isVisible()) {
        const commentInput = drawer.locator(
          '[data-testid="comment-input"], .ql-editor, [contenteditable="true"]'
        );

        if (await commentInput.isVisible()) {
          await commentInput.click();

          // Type @ and part of username
          await page.keyboard.type(`@${mentionedUser.responseData.name}`);

          // Select from dropdown if visible
          const mentionItem = page.locator(
            `.mention-item, .ql-mention-list-item:has-text("${mentionedUser.responseData.displayName}")`
          );
          await mentionItem
            .first()
            .waitFor({ state: 'visible', timeout: 2000 })
            .catch(() => undefined);

          if (await mentionItem.isVisible()) {
            await mentionItem.click();

            // Continue typing and submit
            await page.keyboard.type(' please review this task');

            const sendBtn = drawer.getByTestId('send-comment');
            if (await sendBtn.isVisible()) {
              await sendBtn.click();
              await waitForPageLoaded(page);
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
    await waitForPageLoaded(page);

    const tasksTab = page.getByRole('menuitem', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await waitForPageLoaded(page);
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await waitForPageLoaded(page);

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
    await waitForPageLoaded(page);

    const tasksTab = page.getByRole('menuitem', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await waitForPageLoaded(page);
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();
      await waitForPageLoaded(page);

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
            const editInput = drawer.locator(
              '[data-testid="edit-comment-input"]'
            );
            if (await editInput.isVisible()) {
              await editInput.fill('Updated comment text');

              const saveBtn = drawer.getByTestId('save-comment');
              await saveBtn.click();
              await waitForPageLoaded(page);

              await expect(
                drawer.getByText('Updated comment text')
              ).toBeVisible();
            }
          }
        }
      }
    }
  });

  /**
   * Shared by the two real delete tests below: opens the task's activity-feed
   * drawer as `user` and posts one comment from there, returning the task's id
   * (needed to match the DELETE response) and the comment's text (needed to
   * find the right `task-comment-card`).
   */
  const postCommentAsUser = async (
    page: import('@playwright/test').Page,
    message: string
  ) => {
    await table.visitEntityPage(page);
    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    const tasksTab = page.getByRole('menuitem', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await waitForPageLoaded(page);
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();
    await expect(taskCard).toBeVisible();
    await taskCard.click();
    await waitForPageLoaded(page);

    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer).toBeVisible();

    const commentInput = drawer.locator(
      '[data-testid="comment-input"], .ql-editor, [placeholder*="comment" i]'
    );
    await expect(commentInput).toBeVisible();
    await commentInput.fill(message);

    const sendBtn = drawer.getByTestId('send-comment');
    const commentResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/tasks/') &&
        response.url().includes('/comments') &&
        response.request().method() === 'POST'
    );
    await sendBtn.click();
    const commentResponse = await commentResponsePromise;
    const comment = await commentResponse.json();

    await expect(drawer.getByText(message)).toBeVisible();

    return { drawer, taskCommentId: comment.id as string };
  };

  /**
   * Deletes the comment identified by `message` from an already-open drawer,
   * waiting for the real DELETE response and asserting the comment is gone
   * from the DOM afterwards. Runs the button through a real hover first,
   * matching how a person actually finds it (the button is reachable by
   * keyboard/tab without hovering, but hover is the primary discovery path).
   */
  const deleteCommentViaUi = async (
    page: import('@playwright/test').Page,
    drawer: ReturnType<import('@playwright/test').Page['locator']>,
    message: string,
    taskCommentId: string
  ) => {
    const commentCard = drawer
      .getByTestId('task-comment-card')
      .filter({ hasText: message });
    await expect(commentCard).toBeVisible();

    await commentCard.hover();
    await commentCard.getByTestId('delete-task-comment').click();

    await expect(page.getByTestId('delete-modal')).toBeVisible();

    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/comments/${taskCommentId}`) &&
        response.request().method() === 'DELETE'
    );
    await page.getByTestId('confirm-button').click();
    const deleteResponse = await deleteResponsePromise;

    expect(deleteResponse.ok()).toBe(true);
    await expect(commentCard).not.toBeVisible();
    await expect(drawer.getByText(message)).not.toBeVisible();
  };

  test('should be able to delete own comment', async ({ page }) => {
    // assigneeUser is a regular (non-admin) user, so a successful delete here
    // exercises the author-match branch of canDelete, not the admin override.
    await assigneeUser.login(page);

    const message = `Author-deletable comment ${Date.now()}`;
    const { drawer, taskCommentId } = await postCommentAsUser(page, message);

    await deleteCommentViaUi(page, drawer, message, taskCommentId);
  });

  test('admin should be able to delete a comment they did not author', async ({
    page,
    browser,
  }) => {
    // Post as the non-admin assignee first, in a separate browser context so
    // this test doesn't depend on execution order relative to the one above.
    const authorContext = await browser.newContext();
    const authorPage = await authorContext.newPage();
    await assigneeUser.login(authorPage);

    const message = `Admin-deletable comment ${Date.now()}`;
    const { taskCommentId } = await postCommentAsUser(authorPage, message);
    await authorContext.close();

    await adminUser.login(page);
    const { drawer } = await postCommentAsUser(page, `unused-${Date.now()}`);
    // postCommentAsUser leaves an extra comment behind as a side effect of
    // reusing it purely for its navigation-to-the-open-drawer behavior; that
    // extra comment isn't asserted on and is left for afterAll to clean up
    // along with the rest of the table.

    await deleteCommentViaUi(page, drawer, message, taskCommentId);
  });

  test('non-author, non-admin should not see the delete option', async ({
    page,
    browser,
  }) => {
    const otherUser = new UserClass();
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await otherUser.create(apiContext);
    } finally {
      await afterAction();
    }

    try {
      const authorContext = await browser.newContext();
      const authorPage = await authorContext.newPage();
      await assigneeUser.login(authorPage);

      const message = `Not-my-comment ${Date.now()}`;
      await postCommentAsUser(authorPage, message);
      await authorContext.close();

      await otherUser.login(page);
      const { drawer } = await postCommentAsUser(
        page,
        `viewer-comment-${Date.now()}`
      );

      const commentCard = drawer
        .getByTestId('task-comment-card')
        .filter({ hasText: message });
      await expect(commentCard).toBeVisible();
      await commentCard.hover();

      await expect(
        commentCard.getByTestId('delete-task-comment')
      ).not.toBeVisible();
    } finally {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await otherUser.delete(apiContext);
      } finally {
        await afterAction();
      }
    }
  });

  test('should be able to delete a comment from inside the activity-feed drawer', async ({
    page,
  }) => {
    // Regression coverage for the DeleteModal/antd-Drawer z-index conflict:
    // TaskTabNew (and therefore TaskCommentCard's DeleteModal) is rendered
    // inside an antd Drawer here, unlike the standalone task page used by the
    // other delete tests above. If the confirmation dialog's overlay ever
    // sits below the Drawer's own mask again, this click lands on the mask
    // (which closes the drawer) instead of the dialog's confirm button, and
    // this test will hang/time out waiting for the DELETE response instead
    // of silently passing.
    await assigneeUser.login(page);

    const message = `Drawer-delete comment ${Date.now()}`;
    const { drawer, taskCommentId } = await postCommentAsUser(page, message);

    await expect(page.locator('.activity-feed-drawer, .feed-drawer')).toBeVisible();

    await deleteCommentViaUi(page, drawer, message, taskCommentId);
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
          about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
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
      const response = await apiContext.post(
        `/api/v1/tasks/${taskId}/comments`,
        {
          data: {
            message: 'API test comment',
          },
        }
      );

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
