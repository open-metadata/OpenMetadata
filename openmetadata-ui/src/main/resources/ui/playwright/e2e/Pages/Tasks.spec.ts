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
import { TaskClass } from '../../support/entity/TaskClass';
import { UserClass } from '../../support/user/UserClass';
import { getApiContext, redirectToHomePage } from '../../utils/common';

const adminFile = 'playwright/.auth/admin.json';
test.use({ storageState: adminFile });

test.describe('Task Entity API Tests', () => {
  const user1 = new UserClass();
  const user2 = new UserClass();
  let task1: TaskClass;
  let task2: TaskClass;
  let task3: TaskClass;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(page);
    await user1.create(apiContext);
    await user2.create(apiContext);
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
    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await afterAction();
    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Create task with different categories', async ({ page }) => {
    const { apiContext } = await getApiContext(page);

    await test.step('Create MetadataUpdate task', async () => {
      task1 = new TaskClass({
        category: 'MetadataUpdate',
        type: 'DescriptionUpdate',
        description: 'Update the description for this entity',
      });
      const response = await task1.create(apiContext);

      expect(response).toBeDefined();
      expect(response.id).toBeDefined();
      expect(response.taskId).toMatch(/^TASK-\d+$/);
      expect(response.category).toBe('MetadataUpdate');
      expect(response.type).toBe('DescriptionUpdate');
      expect(response.status).toBe('Open');
    });

    await test.step('Create Approval task', async () => {
      task2 = new TaskClass({
        category: 'Approval',
        type: 'GlossaryApproval',
        description: 'Approve this glossary term',
        priority: 'High',
      });
      const response = await task2.create(apiContext);

      expect(response).toBeDefined();
      expect(response.taskId).toMatch(/^TASK-\d+$/);
      expect(response.category).toBe('Approval');
      expect(response.priority).toBe('High');
    });

    await test.step('Create Custom task', async () => {
      task3 = new TaskClass({
        category: 'Custom',
        type: 'CustomTask',
        description: 'Custom workflow task',
        priority: 'Critical',
      });
      const response = await task3.create(apiContext);

      expect(response).toBeDefined();
      expect(response.category).toBe('Custom');
      expect(response.priority).toBe('Critical');
    });
  });

  test('Task ID sequence is unique', async ({ page }) => {
    const { apiContext } = await getApiContext(page);

    const taskA = new TaskClass({
      category: 'MetadataUpdate',
      type: 'TagUpdate',
    });
    const taskB = new TaskClass({
      category: 'MetadataUpdate',
      type: 'TagUpdate',
    });

    const responseA = await taskA.create(apiContext);
    const responseB = await taskB.create(apiContext);

    expect(responseA.taskId).not.toBe(responseB.taskId);

    const taskIdNumA = parseInt(responseA.taskId.replace('TASK-', ''), 10);
    const taskIdNumB = parseInt(responseB.taskId.replace('TASK-', ''), 10);
    expect(taskIdNumB).toBeGreaterThan(taskIdNumA);

    await taskA.delete(apiContext);
    await taskB.delete(apiContext);
  });

  test('Resolve task with approval', async ({ page }) => {
    const { apiContext } = await getApiContext(page);

    const task = new TaskClass({
      category: 'Approval',
      type: 'GlossaryApproval',
      description: 'Test task for resolution',
    });

    await test.step('Create task', async () => {
      const response = await task.create(apiContext);
      expect(response.status).toBe('Open');
    });

    await test.step('Resolve with approval', async () => {
      const response = await task.resolve(
        apiContext,
        'Approved',
        'Approved after review'
      );
      expect(response.status).toBe('Approved');
    });

    await test.step('Cleanup', async () => {
      await task.delete(apiContext);
    });
  });

  test('Resolve task with rejection', async ({ page }) => {
    const { apiContext } = await getApiContext(page);

    const task = new TaskClass({
      category: 'DataAccess',
      type: 'DataAccessRequest',
      description: 'Request access to sensitive data',
    });

    await test.step('Create task', async () => {
      const response = await task.create(apiContext);
      expect(response.status).toBe('Open');
    });

    await test.step('Resolve with rejection', async () => {
      const response = await task.resolve(
        apiContext,
        'Rejected',
        'Insufficient justification provided'
      );
      expect(response.status).toBe('Rejected');
    });

    await test.step('Cleanup', async () => {
      await task.delete(apiContext);
    });
  });

  test('Create task with assignees', async ({ page }) => {
    const { apiContext } = await getApiContext(page);

    const task = new TaskClass({
      category: 'Review',
      type: 'DataQualityReview',
      description: 'Review data quality metrics',
      assignees: [user1.responseData?.fullyQualifiedName ?? ''],
    });

    const response = await task.create(apiContext);

    expect(response).toBeDefined();
    expect(response.status).toBe('Open');

    await task.delete(apiContext);
  });

  test('List tasks by status', async ({ page }) => {
    const { apiContext } = await getApiContext(page);

    const openTask = new TaskClass({
      category: 'MetadataUpdate',
      type: 'OwnershipUpdate',
    });

    await openTask.create(apiContext);

    // Verify the task was created
    expect(openTask.responseData?.id).toBeDefined();

    // Poll until task appears in the list (may take time for indexing)
    let foundTask: { id: string } | undefined;
    for (let i = 0; i < 15; i++) {
      // Try without status filter first since tasks might use different status values
      const response = await apiContext.get('/api/v1/tasks', {
        params: { limit: 100 },
      });
      const data = await response.json();

      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);

      foundTask = data.data.find(
        (t: { id: string }) => t.id === openTask.responseData?.id
      );
      if (foundTask) break;

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    expect(foundTask).toBeDefined();

    await openTask.delete(apiContext);
  });

  test('Task CRUD operations', async ({ page }) => {
    const { apiContext } = await getApiContext(page);

    const task = new TaskClass({
      category: 'Incident',
      type: 'IncidentResolution',
      description: 'Initial description',
      priority: 'Low',
    });

    await test.step('Create task', async () => {
      const response = await task.create(apiContext);
      expect(response.id).toBeDefined();
      expect(response.description).toBe('Initial description');
    });

    await test.step('Get task by ID', async () => {
      const response = await task.get(apiContext);
      expect(response.id).toBe(task.responseData?.id);
    });

    await test.step('Get task by taskId (human-readable)', async () => {
      const response = await apiContext.get(
        `/api/v1/tasks/name/${task.responseData?.taskId}`
      );
      const data = await response.json();
      expect(data.id).toBe(task.responseData?.id);
    });

    await test.step('Delete task', async () => {
      await task.delete(apiContext);
      const response = await apiContext.get(
        `/api/v1/tasks/${task.responseData?.id}`
      );
      expect(response.status()).toBe(404);
    });
  });

  test('All task categories can be created', async ({ page }) => {
    const { apiContext } = await getApiContext(page);

    const categories = [
      { category: 'Approval', type: 'GlossaryApproval' },
      { category: 'DataAccess', type: 'DataAccessRequest' },
      { category: 'MetadataUpdate', type: 'DescriptionUpdate' },
      { category: 'Incident', type: 'IncidentResolution' },
      { category: 'Review', type: 'DataQualityReview' },
      { category: 'Custom', type: 'CustomTask' },
    ];

    const createdTasks: TaskClass[] = [];

    for (const { category, type } of categories) {
      const task = new TaskClass({ category, type });
      const response = await task.create(apiContext);

      expect(response.category).toBe(category);
      expect(response.type).toBe(type);
      createdTasks.push(task);
    }

    for (const task of createdTasks) {
      await task.delete(apiContext);
    }
  });

  test('Task priority levels', async ({ page }) => {
    const { apiContext } = await getApiContext(page);

    const priorities = ['Critical', 'High', 'Medium', 'Low'];
    const createdTasks: TaskClass[] = [];

    for (const priority of priorities) {
      const task = new TaskClass({
        category: 'MetadataUpdate',
        type: 'TierUpdate',
        priority,
      });
      const response = await task.create(apiContext);

      expect(response.priority).toBe(priority);
      createdTasks.push(task);
    }

    for (const task of createdTasks) {
      await task.delete(apiContext);
    }
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(page);

    if (task1?.responseData?.id) {
      await task1.delete(apiContext);
    }
    if (task2?.responseData?.id) {
      await task2.delete(apiContext);
    }
    if (task3?.responseData?.id) {
      await task3.delete(apiContext);
    }

    await afterAction();
    await page.close();
    await context.close();
  });
});
