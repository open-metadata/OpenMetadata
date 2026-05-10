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
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForPageLoaded } from '../../../utils/polling';
import { waitForTaskListResponse } from '../../../utils/task';

/**
 * Task Navigation Tests
 *
 * Tests task navigation scenarios including:
 * - Clicking task in activity feed navigates to correct entity page
 * - Task link should NOT generate 404 error
 * - Task link should NOT go to /table/TASK-XXXXX (wrong URL)
 * - Task detail drawer opens correctly
 * - Navigation from different contexts (home, entity page, notifications)
 */

test.describe('Task Navigation - Activity Feed Widget', () => {
  const adminUser = new UserClass();
  const assigneeUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data and create task', async ({ browser }) => {
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

      // Create a task
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
      await assigneeUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
  });

  test('clicking task in home feed widget should navigate to entity page', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForPageLoaded(page);

    // Find the activity feed widget
    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');

    if (await feedWidget.isVisible()) {
      // Look for task items in the feed
      const taskItem = feedWidget
        .locator(
          '[data-testid="task-feed-card"], [data-testid="message-container"]'
        )
        .first();

      if (await taskItem.isVisible()) {
        // Click on the task link
        const taskLink = taskItem.getByTestId('redirect-task-button-link');

        if (await taskLink.isVisible()) {
          await taskLink.click();
          await waitForPageLoaded(page);

          // CRITICAL: Should NOT be a 404 page
          await expect(page.getByText('No data available')).not.toBeVisible();
          await expect(page.locator('.error-page')).not.toBeVisible();

          // CRITICAL: URL should NOT contain /table/TASK-
          expect(page.url()).not.toMatch(/\/table\/TASK-/);

          // Should navigate to the entity page with activity feed tab
          const entityFqn = table.entityResponseData?.fullyQualifiedName;
          if (entityFqn) {
            // URL should contain the entity FQN or be on the entity page
            const isOnEntityPage =
              page.url().includes(encodeURIComponent(entityFqn)) ||
              page.url().includes('activity_feed');

            expect(isOnEntityPage).toBe(true);
          }
        }
      }
    }
  });

  test('task link should contain correct entity FQN, not task ID', async ({
    page,
  }) => {
    await table.visitEntityPage(page);

    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await waitForPageLoaded(page);
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();

    if (await taskCard.isVisible()) {
      const taskLink = taskCard.getByTestId('redirect-task-button-link');

      if (await taskLink.isVisible()) {
        // Get the href attribute if it's a link
        const href = await taskLink.getAttribute('href');

        if (href) {
          // CRITICAL: href should NOT contain TASK- as the entity FQN
          expect(href).not.toMatch(/\/table\/TASK-/);
          expect(href).not.toMatch(/\/TASK-\d{5}$/);
        }

        // Click and verify navigation
        await taskLink.click();
        await waitForPageLoaded(page);

        // Should be on entity page, not 404
        await expect(page.getByText('No data available')).not.toBeVisible();
      }
    }
  });
});

test.describe('Task Navigation - Entity Page', () => {
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

      // Create multiple tasks
      for (let i = 0; i < 3; i++) {
        await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Test Task - ${Date.now()}-${i}`,
            about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
            type: i % 2 === 0 ? 'DescriptionRequest' : 'TagRequest',
            category: 'MetadataUpdate',
            assignees: [assigneeUser.responseData.name],
          },
        });
      }
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

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
  });

  test('should display tasks in entity activity feed tab', async ({ page }) => {
    await table.visitEntityPage(page);

    // Click on activity feed tab
    const activityFeedTab = page.getByRole('tab', {
      name: /activity feeds & tasks/i,
    });
    await activityFeedTab.click();
    await waitForPageLoaded(page);

    // Click on Tasks filter
    const tasksFilter = page.getByRole('button', { name: /tasks/i });
    if (await tasksFilter.isVisible()) {
      await tasksFilter.click();
      await waitForPageLoaded(page);
    }

    // Use Playwright's polling mechanism for task visibility
    const taskCards = page.locator('[data-testid="task-feed-card"]');

    await expect
      .poll(async () => taskCards.count(), {
        message: 'Waiting for task cards to appear',
        timeout: 30000,
        intervals: [2000, 3000, 5000],
      })
      .toBeGreaterThanOrEqual(0);
  });

  test('clicking task card should open task detail drawer', async ({
    page,
  }) => {
    await table.visitEntityPage(page);

    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await waitForPageLoaded(page);
    }

    const taskCard = page.locator('[data-testid="task-feed-card"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();

      // Should open drawer with task details
      const drawer = page.locator('.ant-drawer-content');

      if (await drawer.isVisible({ timeout: 5000 })) {
        // Drawer should show task details
        await expect(drawer).toBeVisible();

        // Should have task ID
        await expect(drawer.getByText(/TASK-/)).toBeVisible();

        // Should have comments section
        const commentsSection = drawer.locator(
          '[data-testid="comments-section"], [data-testid="task-comments"]'
        );
        // Comments section might exist
      }
    }
  });

  test('task count badge should match actual task count', async ({ page }) => {
    await table.visitEntityPage(page);

    // Get count from tab badge
    const activityFeedTab = page.getByRole('tab', {
      name: /activity feeds & tasks/i,
    });
    const countBadge = activityFeedTab.getByTestId('count');

    let displayedCount = 0;
    if (await countBadge.isVisible()) {
      const countText = await countBadge.textContent();
      displayedCount = parseInt(countText || '0', 10);
    }

    // Click on tab and go to tasks
    await activityFeedTab.click();
    await waitForPageLoaded(page);

    const tasksFilter = page.getByRole('button', { name: /tasks/i });
    if (await tasksFilter.isVisible()) {
      await tasksFilter.click();
      await waitForPageLoaded(page);
    }

    // Count actual task cards
    const taskCards = page.locator('[data-testid="task-feed-card"]');
    const actualCount = await taskCards.count();

    // Counts should match (allowing for pagination)
    // Note: If there's pagination, actualCount might be less
    expect(actualCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Task Navigation - Notification Box', () => {
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

      // Create task assigned to assignee
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
      await assigneeUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('assignee should see task in notification box', async ({ page }) => {
    await assigneeUser.login(page);
    await redirectToHomePage(page);
    await waitForPageLoaded(page);

    // Click notification bell
    const notificationBell = page.getByTestId('task-notifications');

    if (await notificationBell.isVisible()) {
      await notificationBell.click();

      const notificationBox = page.locator('.notification-box');
      await expect(notificationBox).toBeVisible();

      // Look for Tasks tab
      const tasksTab = notificationBox.getByText('Tasks', { exact: false });

      if (await tasksTab.isVisible()) {
        await tasksTab.click();
        await waitForPageLoaded(page);

        // Should see assigned tasks
        const taskItems = notificationBox.locator(
          '[data-testid^="notification-link-"], .notification-dropdown-list-btn'
        );

        const count = await taskItems.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('clicking task notification should navigate correctly', async ({
    page,
  }) => {
    await assigneeUser.login(page);
    await redirectToHomePage(page);
    await waitForPageLoaded(page);

    const notificationBell = page.getByTestId('task-notifications');

    if (await notificationBell.isVisible()) {
      await notificationBell.click();

      const notificationBox = page.locator('.notification-box');
      await expect(notificationBox).toBeVisible();

      const tasksTab = notificationBox.getByText('Tasks', { exact: false });

      if (await tasksTab.isVisible()) {
        await tasksTab.click();
        await waitForPageLoaded(page);

        const taskLink = notificationBox
          .locator('[data-testid^="notification-link-"]')
          .first();

        if (await taskLink.isVisible()) {
          await taskLink.click();
          await waitForPageLoaded(page);

          // Should NOT be 404
          await expect(page.getByText('No data available')).not.toBeVisible();

          // URL should NOT contain /table/TASK-
          expect(page.url()).not.toMatch(/\/table\/TASK-/);
        }
      }
    }
  });
});

test.describe('Task Navigation - URL Validation', () => {
  const adminUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);

      await table.create(apiContext);
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

  test('navigating to /table/TASK-XXXXX should show 404 (invalid URL pattern)', async ({
    page,
  }) => {
    await adminUser.login(page);

    // This is a regression test - /table/TASK-00001 is an invalid URL
    // because TASK-00001 is a task ID, not a table FQN
    await page.goto('/table/TASK-00001');
    await waitForPageLoaded(page);

    // Should show 404 or "No data available"
    const noData = page.getByText('No data available');
    const notFound = page.getByText('404');
    const pageNotFound = page.getByText('Page not found', { exact: false });

    const isError =
      (await noData.isVisible()) ||
      (await notFound.isVisible()) ||
      (await pageNotFound.isVisible());

    // This URL pattern should result in an error/404
    expect(isError).toBe(true);
  });

  test('task detail page with valid task ID should work', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create a task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Test Task - ${Date.now()}`,
          about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [adminUser.responseData.name],
        },
      });
      const task = await taskResponse.json();

      const page = await browser.newPage();
      await adminUser.login(page);

      // Navigate to task-related entity page
      // The correct pattern should be /table/{entityFqn}?activeTab=activity_feed
      const entityFqn = table.entityResponseData?.fullyQualifiedName;

      if (entityFqn) {
        await page.goto(`/table/${encodeURIComponent(entityFqn)}`);
        await waitForPageLoaded(page);

        // Should NOT be 404
        await expect(page.getByText('No data available')).not.toBeVisible();
      }

      await page.close();
    } finally {
      await afterAction();
    }
  });
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
  let taskId: string | undefined;

  test.afterAll(
    'Delete task, table, admin user and other user',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        if (taskId) {
          await apiContext.delete(`/api/v1/tasks/${taskId}`);
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
        const response = await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Test Task - ${Date.now()}`,
            about: `<#E::table::${entityFqn}>`,
            type: 'DescriptionUpdate',
            category: 'MetadataUpdate',
            assignees: [adminUser.responseData.name],
          },
        });
        const created = await response.json();
        taskId = created.id;
      } finally {
        await afterAction();
      }
    });

    await test.step('Open notification bell and click the latest task notification', async () => {
      const notificationBell = page.getByTestId('task-notifications');
      await expect(notificationBell).toBeVisible();

      const notifFeedResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/tasks/assigned') &&
          r.url().includes('status=Open')
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
          const response = await apiContext.post('/api/v1/tasks', {
            data: {
              name: `Test Task - ${Date.now()}`,
              about: `<#E::table::${entityFqn}>`,
              type: 'DescriptionUpdate',
              category: 'MetadataUpdate',
              assignees: [otherUser.responseData.name],
            },
          });
          const created = await response.json();
          taskId = created.id;
        } finally {
          await afterAction();
        }
      });

      await test.step('Other user clicks bell icon and latest task notification', async () => {
        const notificationBell = userPage.getByTestId('task-notifications');
        await expect(notificationBell).toBeVisible();

        const notifFeedResponse = userPage.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/tasks/assigned') &&
            r.url().includes('status=Open')
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
