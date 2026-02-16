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
import { APIRequestContext, expect, Page, test } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { performUserLogin } from '../../utils/user';

const adminFile = 'playwright/.auth/admin.json';
test.use({ storageState: adminFile });

interface TaskData {
  id: string;
  taskId: string;
}

const createTaskViaAPI = async (
  apiContext: APIRequestContext,
  entityFQN: string,
  entityType: string,
  assigneeFQN: string
): Promise<TaskData> => {
  const response = await apiContext.post('/api/v1/tasks', {
    data: {
      name: `Test Task for Comments - ${Date.now()}`,
      category: 'MetadataUpdate',
      type: 'DescriptionUpdate',
      priority: 'Medium',
      about: entityFQN,
      aboutType: entityType,
      assignees: [assigneeFQN],
      payload: {
        suggestedValue: 'Test description',
        currentValue: '',
        field: 'description',
      },
    },
  });

  const task = await response.json();
  return { id: task.id, taskId: task.taskId };
};

const addCommentViaAPI = async (
  apiContext: APIRequestContext,
  taskId: string,
  message: string
): Promise<{ commentId: string }> => {
  const response = await apiContext.post(`/api/v1/tasks/${taskId}/comments`, {
    data: { message },
  });

  const task = await response.json();
  const comments = task.comments ?? [];
  const lastComment = comments[comments.length - 1];
  return { commentId: lastComment?.id };
};

const deleteTaskViaAPI = async (
  apiContext: APIRequestContext,
  taskId: string
): Promise<void> => {
  await apiContext.delete(`/api/v1/tasks/${taskId}?hardDelete=true`);
};

test.describe('Task Comments - API Tests', () => {
  const adminUser = new UserClass();
  const regularUser = new UserClass();
  let table: TableClass;
  let apiContext: APIRequestContext;
  let afterAction: () => Promise<void>;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const result = await getApiContext(page);
    apiContext = result.apiContext;
    afterAction = result.afterAction;

    await adminUser.create(apiContext);
    await regularUser.create(apiContext);
    table = new TableClass();
    await table.create(apiContext);

    await page.close();
    await context.close();
  });

  test.afterAll(async () => {
    await table.delete(apiContext);
    await regularUser.delete(apiContext);
    await adminUser.delete(apiContext);
    await afterAction();
  });

  test('Add comment to a task', async () => {
    const task = await createTaskViaAPI(
      apiContext,
      table.entityResponseData?.['fullyQualifiedName'],
      'table',
      adminUser.responseData?.name ?? ''
    );

    try {
      const commentMessage = 'This is a test comment on the task';
      const response = await apiContext.post(
        `/api/v1/tasks/${task.id}/comments`,
        {
          data: { message: commentMessage },
        }
      );

      expect(response.ok()).toBeTruthy();
      const updatedTask = await response.json();

      expect(updatedTask.comments).toBeDefined();
      expect(updatedTask.comments.length).toBeGreaterThan(0);
      expect(updatedTask.comments[0].message).toBe(commentMessage);
      expect(updatedTask.commentCount).toBe(1);
    } finally {
      await deleteTaskViaAPI(apiContext, task.id);
    }
  });

  test('Add multiple comments to a task', async () => {
    const task = await createTaskViaAPI(
      apiContext,
      table.entityResponseData?.['fullyQualifiedName'],
      'table',
      adminUser.responseData?.name ?? ''
    );

    try {
      const comments = [
        'First comment',
        'Second comment',
        'Third comment with more details',
      ];

      for (const message of comments) {
        const response = await apiContext.post(
          `/api/v1/tasks/${task.id}/comments`,
          {
            data: { message },
          }
        );
        expect(response.ok()).toBeTruthy();
      }

      const getResponse = await apiContext.get(
        `/api/v1/tasks/${task.id}?fields=comments`
      );
      const taskWithComments = await getResponse.json();

      expect(taskWithComments.comments.length).toBe(3);
      expect(taskWithComments.commentCount).toBe(3);
    } finally {
      await deleteTaskViaAPI(apiContext, task.id);
    }
  });

  test('Edit own comment - author can edit', async () => {
    const task = await createTaskViaAPI(
      apiContext,
      table.entityResponseData?.['fullyQualifiedName'],
      'table',
      adminUser.responseData?.name ?? ''
    );

    try {
      const { commentId } = await addCommentViaAPI(
        apiContext,
        task.id,
        'Original message'
      );

      const editResponse = await apiContext.patch(
        `/api/v1/tasks/${task.id}/comments/${commentId}`,
        {
          data: { message: 'Edited message' },
        }
      );

      expect(editResponse.ok()).toBeTruthy();
      const updatedTask = await editResponse.json();
      const editedComment = updatedTask.comments.find(
        (c: { id: string }) => c.id === commentId
      );
      expect(editedComment.message).toBe('Edited message');
    } finally {
      await deleteTaskViaAPI(apiContext, task.id);
    }
  });

  test('Delete own comment - author can delete', async () => {
    const task = await createTaskViaAPI(
      apiContext,
      table.entityResponseData?.['fullyQualifiedName'],
      'table',
      adminUser.responseData?.name ?? ''
    );

    try {
      const { commentId } = await addCommentViaAPI(
        apiContext,
        task.id,
        'Comment to be deleted'
      );

      const deleteResponse = await apiContext.delete(
        `/api/v1/tasks/${task.id}/comments/${commentId}`
      );

      expect(deleteResponse.ok()).toBeTruthy();
      const updatedTask = await deleteResponse.json();
      expect(updatedTask.comments.length).toBe(0);
      expect(updatedTask.commentCount).toBe(0);
    } finally {
      await deleteTaskViaAPI(apiContext, task.id);
    }
  });

  test('Admin can delete any comment', async () => {
    const task = await createTaskViaAPI(
      apiContext,
      table.entityResponseData?.['fullyQualifiedName'],
      'table',
      adminUser.responseData?.name ?? ''
    );

    try {
      const { commentId } = await addCommentViaAPI(
        apiContext,
        task.id,
        'Comment by admin'
      );

      const deleteResponse = await apiContext.delete(
        `/api/v1/tasks/${task.id}/comments/${commentId}`
      );

      expect(deleteResponse.ok()).toBeTruthy();
    } finally {
      await deleteTaskViaAPI(apiContext, task.id);
    }
  });

  test('Comment supports markdown formatting', async () => {
    const task = await createTaskViaAPI(
      apiContext,
      table.entityResponseData?.['fullyQualifiedName'],
      'table',
      adminUser.responseData?.name ?? ''
    );

    try {
      const markdownMessage = `
# Header
- Bullet point 1
- Bullet point 2

**Bold text** and *italic text*

\`\`\`python
def hello():
    print("Hello, World!")
\`\`\`
      `.trim();

      const response = await apiContext.post(
        `/api/v1/tasks/${task.id}/comments`,
        {
          data: { message: markdownMessage },
        }
      );

      expect(response.ok()).toBeTruthy();
      const updatedTask = await response.json();
      expect(updatedTask.comments[0].message).toBe(markdownMessage);
    } finally {
      await deleteTaskViaAPI(apiContext, task.id);
    }
  });

  test('Comment with @mention syntax', async () => {
    const task = await createTaskViaAPI(
      apiContext,
      table.entityResponseData?.['fullyQualifiedName'],
      'table',
      adminUser.responseData?.name ?? ''
    );

    try {
      const mentionMessage = `Hey @${regularUser.responseData?.name}, please review this task.`;

      const response = await apiContext.post(
        `/api/v1/tasks/${task.id}/comments`,
        {
          data: { message: mentionMessage },
        }
      );

      expect(response.ok()).toBeTruthy();
      const updatedTask = await response.json();
      expect(updatedTask.comments[0].message).toBe(mentionMessage);
    } finally {
      await deleteTaskViaAPI(apiContext, task.id);
    }
  });
});

test.describe('Task Comments - Permission Tests', () => {
  const adminUser = new UserClass();
  const regularUser1 = new UserClass();
  const regularUser2 = new UserClass();
  let table: TableClass;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(page);

    await adminUser.create(apiContext);
    await regularUser1.create(apiContext);
    await regularUser2.create(apiContext);
    table = new TableClass();
    await table.create(apiContext);

    await afterAction();
    await page.close();
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(page);

    await table.delete(apiContext);
    await regularUser2.delete(apiContext);
    await regularUser1.delete(apiContext);
    await adminUser.delete(apiContext);

    await afterAction();
    await page.close();
    await context.close();
  });

  test('Non-author cannot edit comment - returns 403', async ({ browser }) => {
    const adminContext = await browser.newContext({ storageState: adminFile });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/');
    await adminPage.waitForURL('**/my-data');
    const { apiContext: adminApiContext, afterAction } =
      await getApiContext(adminPage);

    const task = await createTaskViaAPI(
      adminApiContext,
      table.entityResponseData?.['fullyQualifiedName'],
      'table',
      adminUser.responseData?.name ?? ''
    );

    let user1ApiContext;
    let user1AfterAction;
    try {
      const { commentId } = await addCommentViaAPI(
        adminApiContext,
        task.id,
        'Comment by admin'
      );

      // Authenticate user1 via browser-based login
      const user1Auth = await performUserLogin(browser, regularUser1);
      user1ApiContext = user1Auth.apiContext;
      user1AfterAction = user1Auth.afterAction;

      const editResponse = await user1ApiContext.patch(
        `/api/v1/tasks/${task.id}/comments/${commentId}`,
        {
          data: { message: 'Trying to edit admin comment' },
        }
      );

      expect(editResponse.status()).toBe(403);
    } finally {
      await deleteTaskViaAPI(adminApiContext, task.id);
      await afterAction();
      if (user1AfterAction) await user1AfterAction();
      await adminPage.close();
      await adminContext.close();
    }
  });

  test('Non-author non-admin cannot delete comment - returns 403', async ({
    browser,
  }) => {
    const adminContext = await browser.newContext({ storageState: adminFile });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/');
    await adminPage.waitForURL('**/my-data');
    const { apiContext: adminApiContext, afterAction } =
      await getApiContext(adminPage);

    const task = await createTaskViaAPI(
      adminApiContext,
      table.entityResponseData?.['fullyQualifiedName'],
      'table',
      adminUser.responseData?.name ?? ''
    );

    let user1ApiContext;
    let user1AfterAction;
    try {
      const { commentId } = await addCommentViaAPI(
        adminApiContext,
        task.id,
        'Comment by admin'
      );

      // Authenticate user1 via browser-based login
      const user1Auth = await performUserLogin(browser, regularUser1);
      user1ApiContext = user1Auth.apiContext;
      user1AfterAction = user1Auth.afterAction;

      const deleteResponse = await user1ApiContext.delete(
        `/api/v1/tasks/${task.id}/comments/${commentId}`
      );

      expect(deleteResponse.status()).toBe(403);
    } finally {
      await deleteTaskViaAPI(adminApiContext, task.id);
      await afterAction();
      if (user1AfterAction) await user1AfterAction();
      await adminPage.close();
      await adminContext.close();
    }
  });
});

test.describe('Task Comments - UI Tests', () => {
  const adminUser = new UserClass();
  let table: TableClass;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(page);

    await adminUser.create(apiContext);
    table = new TableClass();
    await table.create(apiContext);

    await afterAction();
    await page.close();
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(page);

    await table.delete(apiContext);
    await adminUser.delete(apiContext);

    await afterAction();
    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('View comments on task in activity feed', async ({ page, browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const apiPage = await context.newPage();
    await apiPage.goto('/');
    await apiPage.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(apiPage);

    const task = await createTaskViaAPI(
      apiContext,
      table.entityResponseData?.['fullyQualifiedName'],
      'table',
      adminUser.responseData?.name ?? ''
    );

    try {
      await addCommentViaAPI(apiContext, task.id, 'Test comment for UI display');

      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="activity_feed"]');

      const taskFeeds = page.waitForResponse('**/api/v1/tasks**');
      await page
        .getByTestId('global-setting-left-panel')
        .getByText('Tasks')
        .click();
      await taskFeeds;

      // Wait for task cards to load
      await page.waitForTimeout(1000);

      // Look for the task card - could be task-feed-card or feed-card-v2
      const taskCard = page.locator('[data-testid="task-feed-card"], .task-feed-card-v1-new').first();
      await expect(taskCard).toBeVisible({ timeout: 10000 });
    } finally {
      await deleteTaskViaAPI(apiContext, task.id);
      await afterAction();
      await apiPage.close();
      await context.close();
    }
  });
});
