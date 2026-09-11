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

import { APIRequestContext, Page } from '@playwright/test';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { Domain } from '../../support/domain/Domain';
import { TableClass } from '../../support/entity/TableClass';
import { TaskClass, TaskResponseData } from '../../support/entity/TaskClass';
import { expect, test as base } from '../../support/fixtures/base';
import { UserClass } from '../../support/user/UserClass';
import { getTableFqn } from '../../utils/activityAPI';
import { performAdminLogin } from '../../utils/admin';
import { okJson, settleAll } from '../../utils/apiResponse';
import { getApiContext } from '../../utils/common';
import {
  assignDomainToEntity,
  selectDomainFromNavbar,
} from '../../utils/domain';
import {
  getTaskCard,
  getTaskDisplayId,
  waitForTaskCreateResponse,
} from '../../utils/task';
import { addTagSuggestion, selectAssignee } from '../../utils/taskWorkflow';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';

type TaskData = {
  apiContext: APIRequestContext;
  author: UserClass;
  owner: UserClass;
  outsider: UserClass;
  table: TableClass;
  unownedTable: TableClass;
  tasks: TaskClass[];
};

const test = base.extend<{ taskData: TaskData }>({
  taskData: async ({ browser }, use) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const author = new UserClass();
    const owner = new UserClass();
    const outsider = new UserClass();
    const table = new TableClass();
    const unownedTable = new TableClass();
    const tasks: TaskClass[] = [];
    try {
      await author.create(apiContext);
      await author.setAdminRole(apiContext);
      await owner.create(apiContext);
      await outsider.create(apiContext);
      await table.create(apiContext);
      await table.setOwner(apiContext, {
        id: owner.responseData.id,
        type: 'user',
      });
      await unownedTable.create(apiContext);
      await use({
        apiContext,
        author,
        owner,
        outsider,
        table,
        unownedTable,
        tasks,
      });
    } finally {
      try {
        await settleAll(tasks.map((task) => task.delete(apiContext)));
        await settleAll(
          [table, unownedTable]
            .filter((entity) => entity.entityResponseData.id)
            .map((entity) => entity.delete(apiContext))
        );
        await settleAll(
          [author, owner, outsider]
            .filter((user) => user.responseData.id)
            .map((user) => user.delete(apiContext))
        );
      } finally {
        await afterAction();
      }
    }
  },
});

const createTask = async (data: TaskData, assignee = data.owner) => {
  const task = new TaskClass({
    about: `<#E::table::${getTableFqn(data.table)}>`,
    assignees: [assignee.responseData.name],
    payload: {
      field: 'description',
      currentValue: data.table.entityResponseData.description ?? '',
      suggestedValue: `Proposed description ${data.tasks.length}`,
    },
  });
  data.tasks.push(task);
  await task.create(data.apiContext);
  return task;
};

const captureCreatedTask = async (
  page: Page,
  data: TaskData,
  submitTestId: string
) => {
  const response = waitForTaskCreateResponse(page);
  await page.getByTestId(submitTestId).click();
  const created = await okJson<TaskResponseData>(
    await response,
    'Create task through UI'
  );
  const task = new TaskClass();
  task.set(created);
  data.tasks.push(task);
  expect(created.status).toBe('Open');
  expect(created.assignees).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: data.owner.responseData.name }),
    ])
  );
  return task;
};

const openTasks = async (page: Page, table: TableClass) => {
  await table.visitEntityPage(page);
  await page.getByTestId('activity_feed').click();
  await page.getByRole('menuitem', { name: /^Tasks/ }).click();
};

const expectDestination = async (page: Page, table: TableClass) => {
  await expect(page).toHaveURL(
    (url) =>
      url.pathname ===
      `/table/${encodeURIComponent(getTableFqn(table))}/activity_feed/tasks`
  );
  await expect(page.getByTestId('entity-header-name')).toHaveText(
    table.entityResponseData.name
  );
};

test.describe('Task Workflow Tests', () => {
  test.describe('Task Creation', () => {
    test.beforeEach(async ({ page, taskData }) => {
      await taskData.author.login(page);
    });

    test('should create request description task from entity page', async ({
      page,
      taskData,
    }) => {
      await taskData.table.visitEntityPage(page);
      await page.getByTestId('request-description').click();
      await expect(page.getByTestId('form-container')).toBeVisible();
      await expect(page.getByTestId('select-assignee')).toContainText(
        taskData.owner.responseData.displayName
      );
      const task = await captureCreatedTask(page, taskData, 'submit-btn');
      await openTasks(page, taskData.table);
      await expect(getTaskCard(page, task.responseData!.taskId)).toBeVisible();
    });

    test('should allow manual assignee selection when entity has no owner', async ({
      page,
      taskData,
    }) => {
      await taskData.unownedTable.visitEntityPage(page);
      await page.getByTestId('request-description').click();
      await expect(page.getByTestId('form-container')).toBeVisible();
      await selectAssignee(page, taskData.owner.responseData.name);
      const task = await captureCreatedTask(page, taskData, 'submit-btn');
      await openTasks(page, taskData.unownedTable);
      await expect(getTaskCard(page, task.responseData!.taskId)).toBeVisible();
    });

    test('should create suggest tags task', async ({ page, taskData }) => {
      await taskData.table.visitEntityPage(page);
      await page.getByTestId('request-entity-tags').click();
      await expect(page.getByTestId('form-container')).toBeVisible();
      await addTagSuggestion({
        page,
        searchText: 'PII',
        tagTestId: 'tag-PII.Sensitive',
      });
      const task = await captureCreatedTask(
        page,
        taskData,
        'submit-tag-request'
      );
      await openTasks(page, taskData.table);
      const card = getTaskCard(page, task.responseData!.taskId);
      await expect(card).toBeVisible();
      await expect(card).toContainText('Sensitive');
    });
  });

  test.describe('Task Navigation', () => {
    for (const title of [
      'clicking task in activity feed should navigate to entity page with task tab',
      'task link should NOT navigate to wrong URL like /table/TASK-xxxxx',
    ]) {
      test(title, async ({ page, taskData }) => {
        const task = await createTask(taskData);
        await taskData.owner.login(page);
        await openTasks(page, taskData.table);
        const card = getTaskCard(page, task.responseData!.taskId);
        await card.getByTestId('redirect-task-button-link').click();
        await expectDestination(page, taskData.table);
        await expect(
          getTaskCard(page, task.responseData!.taskId)
        ).toBeVisible();
      });
    }
  });

  test.describe('Task Resolution and Permissions', () => {
    test('assignee should be able to approve task', async ({
      page,
      taskData,
    }) => {
      const task = await createTask(taskData);
      await taskData.owner.login(page);
      await openTasks(page, taskData.table);
      const response = waitForResponseWithStatus(
        page,
        (result) =>
          result.request().method() === 'POST' &&
          new URL(result.url()).pathname ===
            `/api/v1/tasks/${task.responseData!.id}/resolve`,
        200
      );
      await getTaskCard(page, task.responseData!.taskId)
        .getByTestId('approve-button')
        .click();
      const resolved = await (await response).json();
      expect(resolved.status).toBe('Approved');
      const table = await okJson(
        await taskData.apiContext.get(
          `/api/v1/tables/${taskData.table.entityResponseData.id}`
        ),
        'Read approved description'
      );
      expect(table.description).toBe(task.data.payload!.suggestedValue);
      await taskData.table.visitEntityPage(page);
      await expect(
        page.getByTestId('asset-description-container')
      ).toContainText(table.description);
    });

    test('non-assignee without edit permissions should NOT see approve button', async ({
      page,
      taskData,
    }) => {
      const task = await createTask(taskData);
      await taskData.outsider.login(page);
      await openTasks(page, taskData.table);
      const card = getTaskCard(page, task.responseData!.taskId);
      await expect(card).toBeVisible();
      await expect(card.getByTestId('approve-button')).toHaveCount(0);
      await expect(card.getByTestId('reject-button')).toHaveCount(0);
    });

    test('accepting task without edit permission should be rejected by backend', async ({
      page,
      taskData,
    }) => {
      const policy = new PolicyClass();
      const role = new RolesClass();
      await policy.create(taskData.apiContext, [
        {
          name: 'deny-table-edit',
          resources: ['table'],
          operations: ['EditDescription', 'EditAll'],
          effect: 'deny',
        },
      ]);
      await role.create(taskData.apiContext, [policy.responseData.name]);
      await taskData.outsider.patch({
        apiContext: taskData.apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/-',
            value: { id: role.responseData.id, type: 'role' },
          },
        ],
      });
      const task = await createTask(taskData, taskData.outsider);
      await taskData.outsider.login(page);
      const restricted = await getApiContext(page);
      try {
        const currentUser = await okJson(
          await restricted.apiContext.get('/api/v1/users/loggedInUser'),
          'Verify restricted caller'
        );
        expect(currentUser.id).toBe(taskData.outsider.responseData.id);
        const response = await restricted.apiContext.post(
          `/api/v1/tasks/${task.responseData!.id}/resolve`,
          {
            data: {
              resolutionType: 'Approved',
              newValue: 'Unauthorized description',
            },
          }
        );
        expect(response.status()).toBe(403);
        const stored = await okJson(
          await taskData.apiContext.get(
            `/api/v1/tasks/${task.responseData!.id}`
          ),
          'Read rejected task'
        );
        expect(stored.status).toBe('Open');
        const table = await okJson(
          await taskData.apiContext.get(
            `/api/v1/tables/${taskData.table.entityResponseData.id}`
          ),
          'Read unchanged table'
        );
        expect(table.description).toBe(
          taskData.table.entityResponseData.description
        );
      } finally {
        await restricted.afterAction();
        await role.delete(taskData.apiContext);
        await policy.delete(taskData.apiContext);
      }
    });
  });

  test.describe('Task Count Accuracy', () => {
    test('task count in Activity Feed tab should match actual tasks', async ({
      page,
      taskData,
    }) => {
      const first = await createTask(taskData);
      const second = await createTask(taskData);
      await taskData.owner.login(page);
      await openTasks(page, taskData.table);
      await expect(page.getByTestId('task-feed-card')).toHaveCount(2);
      await expect(getTaskCard(page, first.responseData!.taskId)).toBeVisible();
      await expect(
        getTaskCard(page, second.responseData!.taskId)
      ).toBeVisible();
      await page.getByTestId('user-profile-page-task-filter-icon').click();
      await expect(
        page.getByTestId('open-tasks').locator('.task-count-text')
      ).toHaveText('2');
      await expect(
        page.getByTestId('closed-tasks').locator('.task-count-text')
      ).toHaveText('0');
    });

    test('/tasks/count API should return correct counts for aboutEntity filter', async ({
      taskData,
    }) => {
      await createTask(taskData);
      await createTask(taskData);
      const counts = await okJson(
        await taskData.apiContext.get('/api/v1/tasks/count', {
          params: {
            aboutEntity: getTableFqn(taskData.table),
          },
        }),
        'Count owned fixture tasks'
      );
      expect(counts).toMatchObject({ open: 2, completed: 0, total: 2 });
    });
  });

  test.describe('Activity Feed Integration', () => {
    test('creating a task should appear in entity activity feed', async ({
      page,
      taskData,
    }) => {
      const task = await createTask(taskData);
      await taskData.owner.login(page);
      await openTasks(page, taskData.table);
      await expect(getTaskCard(page, task.responseData!.taskId)).toBeVisible();
    });

    test('task should appear in "My Tasks" filter for assignee', async ({
      page,
      taskData,
    }) => {
      const task = await createTask(taskData);
      await taskData.owner.login(page);
      await page.getByTestId('task-notifications').click();
      const box = page.locator('.notification-box');
      await expect(
        box.getByRole('tab', { name: 'Tasks', exact: true })
      ).toHaveAttribute('aria-selected', 'true');
      await expect(
        box.getByRole('link', {
          name: new RegExp(`^${getTaskDisplayId(task.responseData!.taskId)} `),
        })
      ).toBeVisible();
    });
  });

  test.describe('Domain Filtering', () => {
    test('tasks should respect domain filter when domain is selected', async ({
      page,
      taskData,
    }) => {
      const domain = new Domain();
      const outsideTask = await createTask(taskData);
      try {
        await domain.create(taskData.apiContext);
        await assignDomainToEntity(
          taskData.apiContext,
          taskData.unownedTable,
          domain
        );
        const task = new TaskClass({
          about: `<#E::table::${taskData.unownedTable.entityResponseData.fullyQualifiedName}>`,
          assignees: [taskData.owner.responseData.name],
        });
        taskData.tasks.push(task);
        await task.create(taskData.apiContext);
        await taskData.owner.login(page);
        await page.goto(`/users/${taskData.owner.responseData.name}`, {
          waitUntil: 'domcontentloaded',
        });
        await page.getByRole('tab', { name: 'Tasks', exact: true }).click();
        await expect(
          getTaskCard(page, outsideTask.responseData!.taskId)
        ).toBeVisible();
        await expect(
          getTaskCard(page, task.responseData!.taskId)
        ).toBeVisible();
        await selectDomainFromNavbar(page, domain.responseData);
        await expect(
          getTaskCard(page, task.responseData!.taskId)
        ).toBeVisible();
        await expect(
          getTaskCard(page, outsideTask.responseData!.taskId)
        ).toHaveCount(0);
      } finally {
        if (domain.responseData.id) await domain.delete(taskData.apiContext);
      }
    });
  });
});
