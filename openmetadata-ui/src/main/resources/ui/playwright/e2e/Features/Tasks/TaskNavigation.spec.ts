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

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { getApiContext } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForPageLoaded } from '../../../utils/polling';
import { waitForTaskListResponse } from '../../../utils/task';
import { performAdminLogin } from '../../../utils/admin';
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
  const taskIds: string[] = [];

  test.afterAll(
    'Delete task, table, admin user and other user',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        for (const id of taskIds) {
          await apiContext.delete(`/api/v1/feed/${id}`);
        }
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
      await page.goto(`/table/${encodeURIComponent(entityFqn)}`);
      await waitForPageLoaded(page);
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Open Activity Feed & Tasks tab and stay there', async () => {
      const feedResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/feed') && r.request().method() === 'GET'
      );
      await page.getByTestId('activity_feed').click();
      await feedResponse;
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Create task via API assigned to the logged-in user', async () => {
      const entityFqn = table.entityResponseData?.fullyQualifiedName ?? '';
      const { apiContext, afterAction } = await getApiContext(page);
      try {
        const response = await apiContext.post('/api/v1/feed', {
          data: {
            from: adminUser.responseData.name,
            message: `Update description for table ${entityFqn}`,
            about: `<#E::table::${entityFqn}::description>`,
            type: 'Task',
            taskDetails: {
              type: 'UpdateDescription',
              assignees: [{ id: adminUser.responseData.id, type: 'user' }],
              oldValue: '',
              suggestion: '',
            },
          },
        });
        expect(response.ok(), `Task creation failed: ${await response.text()}`).toBeTruthy();
        const created = await response.json();
        taskIds.push(created.id);
      } finally {
        await afterAction();
      }
    });

    await test.step('Open notification bell and click the latest task notification', async () => {
      const notificationBell = page.getByTestId('task-notifications');
      await expect(notificationBell).toBeVisible();

      const notifFeedResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/feed') &&
          r.url().includes('filterType=ASSIGNED_TO') &&
          r.url().includes('type=Task') &&
          r.request().method() === 'GET'
      );
      await notificationBell.click();
      await notifFeedResponse;

      const notificationBox = page.locator('.notification-box');
      await expect(notificationBox).toBeVisible();

      const latestNotification = notificationBox
        .locator('li.ant-list-item.notification-dropdown-list-btn')
        .first();
      await expect(latestNotification).toBeVisible();

      const taskListRefresh = waitForTaskListResponse(page);
      await latestNotification.click();
      await taskListRefresh;

      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Task list is refreshed with the latest task details', async () => {
      const taskCards = page.locator('[data-testid="task-feed-card"]');

      await expect
        .poll(async () => taskCards.count(), {
          message: 'Waiting for refreshed task list to include the new task',
          timeout: 30_000,
          intervals: [1000, 2000, 3000],
        })
        .toBeGreaterThanOrEqual(1);

      expect(page.url()).not.toMatch(/\/table\/TASK-/);
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
        const schemaTab = adminPage.getByRole('tab', { name: /schema/i });
        if (await schemaTab.isVisible()) {
          await schemaTab.click();
          await waitForAllLoadersToDisappear(adminPage);
        }
      });

      await test.step('Other user navigates to entity Activity Feed & Tasks tab', async () => {
        await userPage.goto(`/table/${encodeURIComponent(entityFqn)}`);
        await waitForPageLoaded(userPage);
        await waitForAllLoadersToDisappear(userPage);
        const feedResponse = userPage.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/feed') && r.request().method() === 'GET'
        );
        await userPage.getByTestId('activity_feed').click();
        await feedResponse;
        await waitForAllLoadersToDisappear(userPage);
      });

      await test.step('Admin creates a task via API and assigns to other user', async () => {
        const { apiContext, afterAction } = await getApiContext(adminPage);
        try {
          const response = await apiContext.post('/api/v1/feed', {
            data: {
              from: adminUser.responseData.name,
              message: `Update description for table ${entityFqn}`,
              about: `<#E::table::${entityFqn}::description>`,
              type: 'Task',
              taskDetails: {
                type: 'UpdateDescription',
                assignees: [{ id: otherUser.responseData.id, type: 'user' }],
                oldValue: '',
                suggestion: '',
              },
            },
          });
          expect(response.ok(), `Task creation failed: ${await response.text()}`).toBeTruthy();
          const created = await response.json();
          taskIds.push(created.id);
        } finally {
          await afterAction();
        }
      });

      await test.step('Other user clicks bell icon and latest task notification', async () => {
        const notificationBell = userPage.getByTestId('task-notifications');
        await expect(notificationBell).toBeVisible();

        const notifFeedResponse = userPage.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/feed') &&
            r.url().includes('filterType=ASSIGNED_TO') &&
            r.url().includes('type=Task') &&
            r.request().method() === 'GET'
        );
        await notificationBell.click();
        await notifFeedResponse;

        const notificationBox = userPage.locator('.notification-box');
        await expect(notificationBox).toBeVisible();

        const latestNotification = notificationBox
          .locator('li.ant-list-item.notification-dropdown-list-btn')
          .first();
        await expect(latestNotification).toBeVisible();

        const taskListRefresh = waitForTaskListResponse(userPage);
        await latestNotification.click();
        await taskListRefresh;

        await waitForAllLoadersToDisappear(userPage);
      });

      await test.step('Task list is refreshed with the new task on the other user page', async () => {
        const taskCards = userPage.locator('[data-testid="task-feed-card"]');

        await expect
          .poll(async () => taskCards.count(), {
            message: 'Waiting for refreshed task list to include the new task',
            timeout: 30_000,
            intervals: [1000, 2000, 3000],
          })
          .toBeGreaterThanOrEqual(1);

        expect(userPage.url()).not.toMatch(/\/table\/TASK-/);
      });
    } finally {
      await adminContext.close();
      await userContext.close();
    }
  });
});
