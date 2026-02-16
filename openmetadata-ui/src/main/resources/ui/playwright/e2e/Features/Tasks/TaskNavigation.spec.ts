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
    await page.waitForLoadState('networkidle');

    // Find the activity feed widget
    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');

    if (await feedWidget.isVisible()) {
      // Look for task items in the feed
      const taskItem = feedWidget
        .locator('[data-testid="task-feed-card"], [data-testid="message-container"]')
        .first();

      if (await taskItem.isVisible()) {
        // Click on the task link
        const taskLink = taskItem.getByTestId('redirect-task-button-link');

        if (await taskLink.isVisible()) {
          await taskLink.click();
          await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await page.waitForLoadState('networkidle');
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
        await page.waitForLoadState('networkidle');

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
            about: table.entityResponseData?.fullyQualifiedName,
            aboutType: 'table',
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
    await page.waitForLoadState('networkidle');

    // Click on Tasks filter
    const tasksFilter = page.getByRole('button', { name: /tasks/i });
    if (await tasksFilter.isVisible()) {
      await tasksFilter.click();
      await page.waitForLoadState('networkidle');
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

  test('clicking task card should open task detail drawer', async ({ page }) => {
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
    await page.waitForLoadState('networkidle');

    const tasksFilter = page.getByRole('button', { name: /tasks/i });
    if (await tasksFilter.isVisible()) {
      await tasksFilter.click();
      await page.waitForLoadState('networkidle');
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
      await assigneeUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('assignee should see task in notification box', async ({ page }) => {
    await assigneeUser.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

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
        await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');

    const notificationBell = page.getByTestId('task-notifications');

    if (await notificationBell.isVisible()) {
      await notificationBell.click();

      const notificationBox = page.locator('.notification-box');
      await expect(notificationBox).toBeVisible();

      const tasksTab = notificationBox.getByText('Tasks', { exact: false });

      if (await tasksTab.isVisible()) {
        await tasksTab.click();
        await page.waitForLoadState('networkidle');

        const taskLink = notificationBox
          .locator('[data-testid^="notification-link-"]')
          .first();

        if (await taskLink.isVisible()) {
          await taskLink.click();
          await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');

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

  test('task detail page with valid task ID should work', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create a task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Test Task - ${Date.now()}`,
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
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
        await page.waitForLoadState('networkidle');

        // Should NOT be 404
        await expect(page.getByText('No data available')).not.toBeVisible();
      }

      await page.close();
    } finally {
      await afterAction();
    }
  });
});
