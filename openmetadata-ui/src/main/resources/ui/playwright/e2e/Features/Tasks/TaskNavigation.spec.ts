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

import { Locator, Page } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { TaskClass } from '../../../support/entity/TaskClass';
import { expect, test } from '../../../support/fixtures/base';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { UserClass } from '../../../support/user/UserClass';
import { getTableFqn } from '../../../utils/activityAPI';
import { performAdminLogin } from '../../../utils/admin';
import {
  deleteFixtureEntity,
  okJson,
  settleAll,
} from '../../../utils/apiResponse';
import { getApiContext } from '../../../utils/common';
import { waitForLandingPageWidget } from '../../../utils/customizeLandingPage';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForPageLoaded } from '../../../utils/polling';
import { waitForTaskListResponse } from '../../../utils/task';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

type NavigationData = {
  table: TableClass;
  user: UserClass;
  tasks: TaskClass[];
};

const navigationTest = test.extend<{ navigationData: NavigationData }>({
  navigationData: async ({ browser }, use) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const user = new UserClass();
    const table = new TableClass();
    const tasks: TaskClass[] = [];
    const persona = new PersonaClass();
    let layoutId: string | undefined;
    try {
      await user.create(apiContext);
      await persona.create(apiContext, [user.responseData.id]);
      const document = await okJson(
        await apiContext.post('/api/v1/docStore', {
          data: {
            name: persona.responseData.name,
            fullyQualifiedName: `persona.${
              persona.responseData.fullyQualifiedName ??
              persona.responseData.name
            }`,
            entityType: 'Page',
            data: {
              pages: [
                {
                  pageType: 'LandingPage',
                  layout: [
                    { i: 'KnowledgePanel.MyTask', x: 0, y: 0, w: 2, h: 3 },
                  ],
                },
              ],
            },
          },
        }),
        'Create task navigation home layout'
      );
      layoutId = document.id;
      await user.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/defaultPersona',
            value: {
              id: persona.responseData.id,
              type: 'persona',
              name: persona.responseData.name,
            },
          },
        ],
      });
      await table.create(apiContext);
      await table.setOwner(apiContext, {
        id: user.responseData.id,
        type: 'user',
      });
      for (let index = 0; index < 3; index++) {
        const task = new TaskClass({
          about: `<#E::table::${getTableFqn(table)}>`,
          assignees: [user.responseData.name],
          payload: {
            suggestedValue: `Description from task ${index}`,
            currentValue: table.entityResponseData.description ?? '',
            field: 'description',
          },
        });
        tasks.push(task);
        await task.create(apiContext);
      }
      await use({ table, user, tasks });
    } finally {
      try {
        await settleAll(tasks.map((task) => task.delete(apiContext)));
        if (table.entityResponseData.id) await table.delete(apiContext);
        if (user.responseData.id) await user.delete(apiContext);
        if (layoutId)
          await deleteFixtureEntity(apiContext, `/api/v1/docStore/${layoutId}`);
        if (persona.responseData.id) await persona.delete(apiContext);
      } finally {
        await afterAction();
      }
    }
  },
  page: async ({ page, navigationData }, use) => {
    await navigationData.user.login(page);
    await use(page);
  },
});

const taskDisplayId = (task: TaskClass) => {
  expect(task.responseData?.taskId).toMatch(/^TASK-\d+$/);
  return `#${Number(task.responseData!.taskId.replace('TASK-', ''))}`;
};

const taskCard = (page: Page, task: TaskClass, scope: Page | Locator = page) =>
  scope.getByTestId('task-feed-card').filter({
    has: page
      .locator('.task-details-id')
      .filter({ hasText: new RegExp(`^${taskDisplayId(task)}\\s*$`) }),
  });

const openEntityTasks = async (
  page: Page,
  { table, tasks }: NavigationData
) => {
  await table.visitEntityPage(page);
  await page.getByTestId('activity_feed').click();
  await page.getByRole('menuitem', { name: /^Tasks/ }).click();
  await expect(page.getByTestId('task-feed-card')).toHaveCount(tasks.length);
};

const expectTaskDestination = async (page: Page, { table }: NavigationData) => {
  const expectedPath = `/table/${encodeURIComponent(
    getTableFqn(table)
  )}/activity_feed/tasks`;
  await expect.poll(() => new URL(page.url()).pathname).toBe(expectedPath);
  await expect(page.getByTestId('entity-header-name')).toHaveText(
    table.entityResponseData.name
  );
};

const openTaskNotifications = async (page: Page, tasks: TaskClass[]) => {
  const notificationResponse = waitForResponseWithStatus(
    page,
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/v1/tasks/assigned',
    200
  );
  await page.getByTestId('task-notifications').click();
  await notificationResponse;
  const box = page.locator('.notification-box');
  await expect(box).toBeVisible();
  await expect(
    box.getByRole('tab', { name: 'Tasks', exact: true })
  ).toHaveAttribute('aria-selected', 'true');
  for (const task of tasks) {
    await expect(
      box.getByRole('link', { name: new RegExp(`^${taskDisplayId(task)} `) })
    ).toBeVisible();
  }
  return box;
};

navigationTest.describe('Task Navigation - Activity Feed Widget', () => {
  navigationTest(
    'clicking task in home feed widget should navigate to entity page',
    async ({ page, navigationData }) => {
      const widget = await waitForLandingPageWidget(
        page,
        'KnowledgePanel.MyTask'
      );
      const [task] = navigationData.tasks;
      await taskCard(page, task, widget)
        .getByTestId('redirect-task-button-link')
        .click();
      await expectTaskDestination(page, navigationData);
      await expect(taskCard(page, task)).toBeVisible();
    }
  );

  navigationTest(
    'task link should contain correct entity FQN, not task ID',
    async ({ page, navigationData }) => {
      await openEntityTasks(page, navigationData);
      await taskCard(page, navigationData.tasks[0])
        .getByTestId('redirect-task-button-link')
        .click();
      await expectTaskDestination(page, navigationData);
    }
  );
});

navigationTest.describe('Task Navigation - Entity Page', () => {
  navigationTest(
    'should display tasks in entity activity feed tab',
    async ({ page, navigationData }) => {
      await openEntityTasks(page, navigationData);
      for (const task of navigationData.tasks)
        await expect(taskCard(page, task)).toBeVisible();
    }
  );

  navigationTest(
    'clicking task card should open task detail panel',
    async ({ page, navigationData }) => {
      await openEntityTasks(page, navigationData);
      const [task] = navigationData.tasks;
      await taskCard(page, task).click();
      const drawer = page.locator('#task-panel');
      await expect(drawer).toBeVisible();
      await expect(drawer).toContainText(taskDisplayId(task));
      await expect(drawer).toContainText(
        navigationData.table.entityResponseData.name
      );
      await expect(
        drawer.getByRole('textbox', {
          name: 'Use @mention to tag and comment...',
        })
      ).toBeVisible();
    }
  );

  navigationTest(
    'task count badge should match actual task count',
    async ({ page, navigationData }) => {
      await openEntityTasks(page, navigationData);
      await expect(page.getByTestId('left-panel-task-count')).toHaveText(
        String(navigationData.tasks.length)
      );
      await expect(page.getByTestId('task-feed-card')).toHaveCount(
        navigationData.tasks.length
      );
    }
  );
});

navigationTest.describe('Task Navigation - Notification Box', () => {
  navigationTest(
    'assignee should see task in notification box',
    async ({ page, navigationData }) => {
      const box = await openTaskNotifications(page, navigationData.tasks);
      await expect(
        box.locator('li.notification-dropdown-list-btn')
      ).toHaveCount(navigationData.tasks.length);
    }
  );

  navigationTest(
    'clicking task notification should navigate correctly',
    async ({ page, navigationData }) => {
      const box = await openTaskNotifications(page, navigationData.tasks);
      const [task] = navigationData.tasks;
      await box
        .getByRole('link', { name: new RegExp(`^${taskDisplayId(task)} `) })
        .click();
      await expectTaskDestination(page, navigationData);
      await expect(taskCard(page, task)).toBeVisible();
    }
  );
});

navigationTest.describe('Task Navigation - URL Validation', () => {
  navigationTest(
    'navigating to /table/TASK-XXXXX should show 404 (invalid URL pattern)',
    async ({ page }) => {
      const missingTable = waitForResponseWithStatus(
        page,
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === '/api/v1/tables/name/TASK-00001',
        404
      );
      await page.goto('/table/TASK-00001', { waitUntil: 'domcontentloaded' });
      await missingTable;
      await expect(
        page.getByText('No data available.', { exact: true })
      ).toBeVisible();
    }
  );

  navigationTest(
    'task detail page with valid task ID should work',
    async ({ page, navigationData }) => {
      const {
        table,
        tasks: [task],
      } = navigationData;
      await page.goto(
        `/table/${encodeURIComponent(getTableFqn(table))}/activity_feed/tasks`,
        { waitUntil: 'domcontentloaded' }
      );
      await taskCard(page, task).click();
      await expectTaskDestination(page, navigationData);
      await expect(page.locator('#task-panel')).toContainText(
        taskDisplayId(task)
      );
    }
  );
});

/**
 * Task Notification Refresh (Issue #27433)
 *
 * Single-page scenario:
 *   1. User navigates directly to a test-owned table entity page.
 *   2. Opens "Activity Feed & Tasks" tab and stays there.
 *   3. A task is created via API assigned to the same logged-in user.
 *   4. User opens the notification bell and clicks the latest task notification,
 *      which points to the same entity/activity-feed URL already open.
 *   5. The fix (tasksRefreshKey in navigation state) must trigger a re-fetch so
 *      the task list updates without a full page reload.
 */
test.describe('Task Notification - activity-feed tab refreshes after clicking notification', () => {
  let adminUser: UserClass;
  let otherUser: UserClass;
  let table: TableClass;
  let createdTask: TaskClass;

  test.afterAll(
    'Delete task, table, admin user and other user',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await createdTask?.delete(apiContext);
        await table.delete(apiContext);
        await adminUser.delete(apiContext);
        await otherUser.delete(apiContext);
      } finally {
        await afterAction();
      }
    }
  );

  test.beforeAll(
    'Create admin user, other user and table',
    async ({ browser }) => {
      adminUser = new UserClass();
      otherUser = new UserClass();
      table = new TableClass();
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await adminUser.create(apiContext);
        await adminUser.setAdminRole(apiContext);
        await otherUser.create(apiContext);
        await table.create(apiContext);
      } finally {
        await afterAction();
      }
    }
  );

  test('clicking task notification while on entity task tab refreshes the task list', async ({
    page,
  }) => {
    test.slow();

    await test.step('Log in and navigate to entity page', async () => {
      await adminUser.login(page);
      const entityFqn = table.entityResponseData?.fullyQualifiedName ?? '';
      await page.goto(`/table/${encodeURIComponent(entityFqn)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForPageLoaded(page);
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Open Activity Feed & Tasks tab and stay there', async () => {
      const feedResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/activity') && r.request().method() === 'GET'
      );
      await page.getByTestId('activity_feed').click();
      await feedResponse;
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Create task via API assigned to the logged-in user', async () => {
      const entityFqn = table.entityResponseData?.fullyQualifiedName ?? '';
      const { apiContext, afterAction } = await getApiContext(page);
      try {
        createdTask = new TaskClass({
          about: `<#E::table::${entityFqn}>`,
          assignees: [adminUser.responseData.name],
          payload: {
            field: 'description',
            suggestedValue: 'Updated description',
            currentValue: table.entityResponseData.description ?? '',
          },
        });
        await createdTask.create(apiContext);
      } finally {
        await afterAction();
      }
    });

    await test.step('Open notification bell and click the latest task notification', async () => {
      const notificationBox = await openTaskNotifications(page, [createdTask]);
      const latestNotification = notificationBox.getByRole('link', {
        name: new RegExp(`^${taskDisplayId(createdTask)} `),
      });

      const taskListRefresh = waitForTaskListResponse(page);
      await latestNotification.click();
      await taskListRefresh;

      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Task list is refreshed with the latest task details', async () => {
      await expect(taskCard(page, createdTask)).toBeVisible();
      await expectTaskDestination(page, {
        table,
        user: adminUser,
        tasks: [createdTask],
      });
    });
  });

  test('two sessions: admin on Columns tab creates task, assignee sees refresh on notification click', async ({
    browser,
  }) => {
    test.slow();

    const entityFqn = table.entityResponseData?.fullyQualifiedName ?? '';

    const adminContext = await browser.newContext();
    const userContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const userPage = await userContext.newPage();

    try {
      await test.step('Log in both sessions', async () => {
        await adminUser.login(adminPage);
        await otherUser.login(userPage);
      });

      await test.step('Admin navigates to entity Columns (Schema) tab', async () => {
        await table.visitEntityPage(adminPage);
        await expect(adminPage.getByTestId('name-column-header')).toBeVisible();
      });

      await test.step('Other user navigates to entity Activity Feed & Tasks tab', async () => {
        await userPage.goto(`/table/${encodeURIComponent(entityFqn)}`, {
          waitUntil: 'domcontentloaded',
        });
        await waitForPageLoaded(userPage);
        await waitForAllLoadersToDisappear(userPage);
        const feedResponse = userPage.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/activity') &&
            r.request().method() === 'GET'
        );
        await userPage.getByTestId('activity_feed').click();
        await feedResponse;
        await waitForAllLoadersToDisappear(userPage);
      });

      await test.step('Admin creates a task via API and assigns to other user', async () => {
        const { apiContext, afterAction } = await getApiContext(adminPage);
        try {
          createdTask = new TaskClass({
            about: `<#E::table::${entityFqn}>`,
            assignees: [otherUser.responseData.name],
            payload: {
              field: 'description',
              suggestedValue: 'Updated description',
              currentValue: table.entityResponseData.description ?? '',
            },
          });
          await createdTask.create(apiContext);
        } finally {
          await afterAction();
        }
      });

      await test.step('Other user clicks bell icon and latest task notification', async () => {
        const notificationBox = await openTaskNotifications(userPage, [
          createdTask,
        ]);
        const latestNotification = notificationBox.getByRole('link', {
          name: new RegExp(`^${taskDisplayId(createdTask)} `),
        });

        const taskListRefresh = waitForTaskListResponse(userPage);
        await latestNotification.click();
        await taskListRefresh;

        await waitForAllLoadersToDisappear(userPage);
      });

      await test.step('Task list is refreshed with the new task on the other user page', async () => {
        await expect(taskCard(userPage, createdTask)).toBeVisible();
        await expectTaskDestination(userPage, {
          table,
          user: otherUser,
          tasks: [createdTask],
        });
      });
    } finally {
      await adminContext.close();
      await userContext.close();
    }
  });
});
