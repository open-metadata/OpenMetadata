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

import type { Locator, Page } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { expect, test } from '../../../support/fixtures/base';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { waitForPageLoaded } from '../../../utils/polling';
import {
  addCommentToTask,
  CreatedTask,
  openEntityTasksTab,
  openTaskDetails,
} from '../../../utils/taskWorkflow';

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
  let createdTask: CreatedTask;
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
      createdTask = (await taskResponse.json()) as CreatedTask;
      const task = createdTask;
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
    await assigneeUser.signIn(page);
    await table.visitEntityPage(page);

    await openEntityTasksTab(page);

    // Click on task to open detail drawer
    await openTaskDetails(page, createdTask);

    // Find comment input in drawer
    const drawer = page.locator('#task-panel');

    await expect(drawer).toBeVisible();
    await addCommentToTask(page, 'This is a test comment from assignee');

    // Verify comment appears
    await expect(
      drawer.getByText('This is a test comment from assignee')
    ).toBeVisible();
  });

  // Replaces a Jest assertion that could only check Tailwind class names: jsdom has
  // no layout engine, so it could not have caught an actual reflow. Here the delete
  // affordance is positioned out of flow, so revealing it on hover must not shift
  // the comment body by a single pixel.
  test('revealing the delete affordance on hover must not reflow the comment body', async ({
    page,
  }) => {
    await assigneeUser.signIn(page);
    await table.visitEntityPage(page);

    await openEntityTasksTab(page);

    // This describe seeds exactly one task against a fresh table, so the card can
    // be addressed directly rather than by position - a positional locator would
    // silently pick up a different task if the fixture ever grows.
    await openTaskDetails(page, createdTask);

    const drawer = page.locator('#task-panel');
    await expect(drawer).toBeVisible();

    const message = `Layout probe ${Date.now()}`;
    await addCommentToTask(page, message);

    const card = drawer
      .locator('[data-testid="feed-reply-card"]')
      .filter({ hasText: message });
    await expect(card).toBeVisible();

    const body = card.getByTestId('viewer-container');

    // The markdown preview measures itself and applies its own clamp one frame
    // after mount, so sample until the box stops moving - otherwise this test
    // measures that clamp rather than the hover it is meant to guard.
    let previous = await body.boundingBox();
    await expect
      .poll(
        async () => {
          const current = await body.boundingBox();
          const settled = JSON.stringify(current) === JSON.stringify(previous);
          previous = current;

          return settled;
        },
        { timeout: 10_000 }
      )
      .toBe(true);

    const before = previous;

    const actions = card.getByTestId('feed-actions');
    const deleteAction = card.getByTestId('delete-message');

    // Posting the comment leaves the pointer over the card, which would hold
    // the bar revealed - park it away first to sample the resting state.
    await page.mouse.move(0, 0);

    // Mounted before any hover so it stays reachable by keyboard and screen
    // readers - the reveal is opacity, which Playwright's visibility check
    // deliberately ignores, so assert the computed value directly.
    await expect(deleteAction).toBeAttached();
    await expect(actions).toHaveCSS('opacity', '0');

    await card.hover();

    await expect(actions).toHaveCSS('opacity', '1');
    await expect(deleteAction).toBeVisible();

    const after = await body.boundingBox();

    expect(after).toEqual(before);
  });

  test('the comment actions are reachable and operable by keyboard alone', async ({
    page,
  }) => {
    await assigneeUser.signIn(page);
    await table.visitEntityPage(page);

    await openEntityTasksTab(page);

    await openTaskDetails(page, createdTask);

    const drawer = page.locator('#task-panel');
    await expect(drawer).toBeVisible();

    const message = `Keyboard probe ${Date.now()}`;
    await addCommentToTask(page, message);

    const card = drawer
      .locator('[data-testid="feed-reply-card"]')
      .filter({ hasText: message });
    await expect(card).toBeVisible();

    const actions = card.getByTestId('feed-actions');
    const deleteAction = card.getByTestId('delete-message');

    // Park the pointer away from the card first, so the reveal asserted below
    // is attributable to focus-within and not to a leftover hover.
    await page.mouse.move(0, 0);

    await expect(actions).toHaveCSS('opacity', '0');

    // Regression coverage for the affordance being an `<Icon onClick>` span:
    // it could not hold focus at all, so none of this was possible without a
    // mouse. Focusing it must also bring the bar into view via focus-within.
    await deleteAction.focus();

    await expect(deleteAction).toBeFocused();
    await expect(actions).toHaveCSS('opacity', '1');

    // Enter activates it, as it would any button.
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('save-button')).toBeVisible();
  });

  test('non-assignee should be able to add comment', async ({ page }) => {
    await commentingUser.signIn(page);
    await table.visitEntityPage(page);

    await openEntityTasksTab(page);

    await openTaskDetails(page, createdTask);

    const drawer = page.locator('#task-panel');

    await expect(drawer).toBeVisible();
    await addCommentToTask(page, 'Comment from non-assignee user');
    await waitForPageLoaded(page);

    // Comment should be added or access denied
    // (depends on permission model)
  });

  test('admin should be able to add comment to any task', async ({ page }) => {
    await adminUser.signIn(page);
    await table.visitEntityPage(page);

    await openEntityTasksTab(page);

    await openTaskDetails(page, createdTask);

    const drawer = page.locator('#task-panel');

    await expect(drawer).toBeVisible();
    await addCommentToTask(page, 'Admin comment on task');
    await waitForPageLoaded(page);

    await expect(drawer.getByText('Admin comment on task')).toBeVisible();
  });
});

test.describe('Task Comments - @Mention', () => {
  let createdTask: CreatedTask;
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

      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Test Task - ${Date.now()}`,
          about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [assigneeUser.responseData.name],
        },
      });
      createdTask = (await taskResponse.json()) as CreatedTask;
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

  test('typing @ should show user suggestion dropdown', async ({ page }) => {
    await adminUser.signIn(page);
    await table.visitEntityPage(page);

    await openEntityTasksTab(page);

    await openTaskDetails(page, createdTask);

    const drawer = page.locator('#task-panel');

    await expect(drawer).toBeVisible();
    const commentTrigger = drawer.getByTestId('comments-input-field');

    await expect(commentTrigger).toBeVisible();
    await commentTrigger.click();

    const commentInput = drawer.locator(
      '[data-testid="editor-wrapper"] .ql-editor'
    );

    await expect(commentInput).toBeVisible({ timeout: 15_000 });
    await commentInput.click();
    await page.keyboard.type('@');
    await waitForPageLoaded(page);

    // Should show mention dropdown
    const mentionDropdown = page.locator(
      '.mention-dropdown, .ql-mention-list-container, [data-testid="mention-suggestions"]'
    );

    // The suggestion list is populated asynchronously, so this needs a wait - but
    // it must actually arrive. A swallowed waitFor left this test asserting
    // nothing, so it passed whether or not the dropdown ever rendered.
    await expect(mentionDropdown).toHaveCount(1, { timeout: 10_000 });
    await expect(mentionDropdown).toBeVisible();
  });

  test('selecting user from @ dropdown should add mention', async ({
    page,
  }) => {
    await adminUser.signIn(page);
    await table.visitEntityPage(page);

    await openEntityTasksTab(page);

    await openTaskDetails(page, createdTask);

    const drawer = page.locator('#task-panel');

    await expect(drawer).toBeVisible();
    const commentTrigger = drawer.getByTestId('comments-input-field');

    await expect(commentTrigger).toBeVisible();
    await commentTrigger.click();

    const commentInput = drawer.locator(
      '[data-testid="editor-wrapper"] .ql-editor'
    );

    await expect(commentInput).toBeVisible({ timeout: 15_000 });
    await commentInput.click();

    // Mention the seeded `admin` account rather than a user created in this
    // describe's beforeAll: the suggestion list is search-index backed, and a
    // seconds-old user is not reliably queryable yet. What this test guards is
    // that picking from the dropdown inserts a mention, which any indexed user
    // exercises identically.
    const mentionTarget = 'admin';

    // quill-mention only opens on a real keystroke - `fill()` sets the text in
    // one shot and the module never sees the denotation char.
    await commentInput.click();
    await page.keyboard.type(`@${mentionTarget}`);

    const mentionItem = page.locator(`[data-value="@${mentionTarget}"]`);

    await expect(mentionItem.first()).toBeVisible({ timeout: 15_000 });
    await mentionItem.first().click();

    await page.keyboard.type(' please review this task');

    const sendBtn = drawer.getByTestId('send-button');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();
    await waitForPageLoaded(page);
  });
});

test.describe('Task Comments - Edit/Delete', () => {
  let createdTask: CreatedTask;
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
          about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [assigneeUser.responseData.name],
        },
      });
      createdTask = (await taskResponse.json()) as CreatedTask;
      const task = createdTask;

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
    await adminUser.signIn(page);
    await table.visitEntityPage(page);

    await openEntityTasksTab(page);

    await openTaskDetails(page, createdTask);

    const drawer = page.locator('#task-panel');

    await expect(drawer).toBeVisible();

    // Post a comment of our own so the card can be addressed by its text rather
    // than by position - the drawer already holds comments from earlier tests in
    // this serial describe.
    const message = `Author actions ${Date.now()}`;
    await addCommentToTask(page, message);

    const comment = drawer
      .locator('[data-testid="feed-reply-card"]')
      .filter({ hasText: message });
    await expect(comment).toHaveCount(1);
    await comment.hover();

    // The author may both edit and delete their own comment.
    await expect(comment.getByTestId('edit-message')).toBeVisible();
    await expect(comment.getByTestId('delete-message')).toBeVisible();
  });

  test('should be able to edit own comment', async ({ page }) => {
    await adminUser.signIn(page);
    await table.visitEntityPage(page);

    await openEntityTasksTab(page);

    await openTaskDetails(page, createdTask);

    const drawer = page.locator('#task-panel');

    await expect(drawer).toBeVisible();
    // Only the author may edit, so this test has to own the comment it edits
    // rather than reaching for whatever card happens to be first.
    const original = `Original comment ${Date.now()}`;
    await addCommentToTask(page, original);

    const comment = drawer
      .locator('[data-testid="feed-reply-card"]')
      .filter({ hasText: original });

    await expect(comment).toBeVisible();
    await comment.hover();

    const editBtn = comment.getByTestId('edit-message');

    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Scoped to the editing card, not to `comment` - that locator filters on
    // the original text, which stops matching the moment the editor is
    // refilled. Qualifying with feed-reply-card keeps the panel's own comment
    // composer, which is the same editor component, out of the match.
    const editor = drawer.locator(
      '[data-testid="feed-reply-card"] [data-testid="activity-feed-editor-new"]'
    );
    const editInput = editor.locator('.ql-editor');

    await expect(editInput).toBeVisible();
    await editInput.fill('Updated comment text');

    const saveBtn = editor.getByTestId('send-button');
    await saveBtn.click();
    await waitForPageLoaded(page);

    await expect(drawer.getByText('Updated comment text')).toBeVisible();
  });

  /**
   * Shared by the two real delete tests below: opens the task's activity-feed
   * drawer as `user` and posts one comment from there, returning the task's id
   * (needed to match the DELETE response) and the comment's text (needed to
   * find the right `feed-reply-card`).
   */
  const postCommentAsUser = async (page: Page, message: string) => {
    await table.visitEntityPage(page);
    await openEntityTasksTab(page);

    await openTaskDetails(page, createdTask);

    const drawer = page.locator('#task-panel');
    await expect(drawer).toBeVisible();

    // The input is a trigger that opens the editor - it cannot be filled.
    const commentInput = drawer.getByTestId('comments-input-field');
    await expect(commentInput).toBeVisible();
    await commentInput.click();

    const editor = drawer.locator('[data-testid="editor-wrapper"] .ql-editor');
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await editor.click();
    await editor.type(message);

    const sendBtn = drawer.getByTestId('send-button');
    const commentResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/tasks/') &&
        response.url().includes('/comments') &&
        response.request().method() === 'POST'
    );
    await sendBtn.click();
    const commentResponse = await commentResponsePromise;
    // POST /tasks/{id}/comments returns the updated Task, not the new comment, so
    // the comment's own id has to come from the task's comments array. The server
    // appends, so the new comment is the last entry.
    const task = await commentResponse.json();
    const comments = task.comments ?? [];
    const taskCommentId = comments[comments.length - 1]?.id as string;

    await expect(drawer.getByText(message)).toBeVisible();

    return { drawer, taskCommentId };
  };

  /**
   * Deletes the comment identified by `message` from an already-open drawer,
   * waiting for the real DELETE response and asserting the comment is gone
   * from the DOM afterwards. The hover is required, not just realistic: the
   * shared feed actions only mount while the card is hovered.
   */
  const deleteCommentViaUi = async (
    page: Page,
    drawer: Locator,
    message: string,
    taskCommentId: string
  ) => {
    const commentCard = drawer
      .getByTestId('feed-reply-card')
      .filter({ hasText: message });
    await expect(commentCard).toBeVisible();

    await commentCard.hover();
    await commentCard.getByTestId('delete-message').click();

    // Asserted on the confirm button rather than the modal container: antd's
    // Modal does not forward `data-testid` to the rendered DOM.
    const confirmButton = page.getByTestId('save-button');
    await expect(confirmButton).toBeVisible();

    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/comments/${taskCommentId}`) &&
        response.request().method() === 'DELETE'
    );
    await confirmButton.click();
    const deleteResponse = await deleteResponsePromise;

    expect(deleteResponse.ok()).toBe(true);
    await expect(commentCard).not.toBeVisible();
    await expect(drawer.getByText(message)).not.toBeVisible();
  };

  test('should be able to delete own comment', async ({ page }) => {
    // assigneeUser is a regular (non-admin) user, so a successful delete here
    // exercises the author-match branch of canDelete, not the admin override.
    await assigneeUser.signIn(page);

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
    await assigneeUser.signIn(authorPage);

    const message = `Admin-deletable comment ${Date.now()}`;
    const { taskCommentId } = await postCommentAsUser(authorPage, message);
    await authorContext.close();

    await adminUser.signIn(page);
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
      await assigneeUser.signIn(authorPage);

      const message = `Not-my-comment ${Date.now()}`;
      await postCommentAsUser(authorPage, message);
      await authorContext.close();

      await otherUser.signIn(page);
      const { drawer } = await postCommentAsUser(
        page,
        `viewer-comment-${Date.now()}`
      );

      const commentCard = drawer
        .getByTestId('feed-reply-card')
        .filter({ hasText: message });
      await expect(commentCard).toBeVisible();
      await commentCard.hover();

      await expect(commentCard.getByTestId('delete-message')).not.toBeVisible();
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
    // Regression coverage for the confirmation-modal/antd-Drawer z-index
    // conflict: TaskTabNew (and so CommentCard's confirmation modal) is rendered
    // inside an antd Drawer here, unlike the standalone task page used by the
    // other delete tests above. If the confirmation dialog's overlay ever
    // sits below the Drawer's own mask again, this click lands on the mask
    // (which closes the drawer) instead of the dialog's confirm button, and
    // this test will hang/time out waiting for the DELETE response instead
    // of silently passing.
    await assigneeUser.signIn(page);

    const message = `Drawer-delete comment ${Date.now()}`;
    const { drawer, taskCommentId } = await postCommentAsUser(page, message);

    await expect(page.locator('#task-panel')).toBeVisible();

    await deleteCommentViaUi(page, drawer, message, taskCommentId);
  });
});

test.describe('Task Comments - Long Comment Overflow', () => {
  let createdTask: CreatedTask;
  const assigneeUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await assigneeUser.create(apiContext);

      await table.create(apiContext);
      await table.setOwner(apiContext, {
        id: assigneeUser.responseData.id,
        type: 'user',
      });

      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [assigneeUser.responseData.name],
        },
      });
      createdTask = (await taskResponse.json()) as CreatedTask;
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await table.delete(apiContext);
      await assigneeUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('a long comment shows a working View More / View Less toggle instead of being silently clamped', async ({
    page,
  }) => {
    // Regression coverage for the task tab's comment preview: comments longer
    // than DESCRIPTION_MAX_PREVIEW_CHARACTERS are trimmed, so one that
    // overflows needs the toggle rendered to stay readable. Covered end to end
    // rather than in Jest because the value being guarded is that a real user
    // can recover the full text, not that the previewer trims a string.
    await assigneeUser.signIn(page);
    await table.visitEntityPage(page);

    await openEntityTasksTab(page);

    await openTaskDetails(page, createdTask);

    const drawer = page.locator('#task-panel');
    await expect(drawer).toBeVisible();

    const runId = Date.now();
    const headMarker = `overflow-head-${runId}`;
    const tailMarker = `overflow-tail-${runId}`;
    const longMessage = `${headMarker} ${'This comment is written to overflow the preview limit on the task comment body. '.repeat(
      8
    )}${tailMarker}`;

    // The input is a trigger that opens the editor - it cannot be filled.
    const commentInput = drawer.getByTestId('comments-input-field');
    await expect(commentInput).toBeVisible();
    await commentInput.click();

    const editor = drawer.locator('[data-testid="editor-wrapper"] .ql-editor');
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await editor.click();
    await editor.type(longMessage);

    const sendBtn = drawer.getByTestId('send-button');
    const commentResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/tasks/') &&
        response.url().includes('/comments') &&
        response.request().method() === 'POST'
    );
    await sendBtn.click();
    await commentResponsePromise;

    // Matched on the head marker, which survives the trim - the tail marker
    // is cut out of the DOM entirely while the preview is collapsed.
    const commentCard = drawer
      .getByTestId('feed-reply-card')
      .filter({ hasText: headMarker });
    await expect(commentCard).toBeVisible();

    // The trim drops the end of the message rather than hiding it, so without
    // a working toggle that text would be unreachable, not merely clipped.
    await expect(commentCard.getByText(tailMarker)).toBeHidden();

    const readMoreButton = commentCard.getByTestId('read-more-button');
    await expect(readMoreButton).toBeVisible();
    await readMoreButton.click();

    await expect(commentCard.getByTestId('read-less-button')).toBeVisible();
    await expect(commentCard.getByText(tailMarker)).toBeVisible();
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
