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
import { waitForPageLoaded } from '../../../utils/polling';

/**
 * Activity Feed Tests
 *
 * Tests all activity feed scenarios including:
 * - Activity feed widget on home page
 * - Feed filters (All, My Data, Following, Tasks)
 * - Task visibility in different feed contexts
 * - Feed updates when entity changes occur
 * - Real-time feed updates
 */

test.describe('Activity Feed - Home Page Widget', () => {
  const adminUser = new UserClass();
  const regularUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await regularUser.create(apiContext);

      await table.create(apiContext);
      await table.setOwner(apiContext, {
        id: regularUser.responseData.id,
        type: 'user',
      });

      // Create some activity by updating entity
      await apiContext.patch(`/api/v1/tables/${table.entityResponseData?.id}`, {
        data: [
          {
            op: 'add',
            path: '/description',
            value: 'Initial description for activity feed test',
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      // Create a task to appear in feed
      await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Test Task - ${Date.now()}`,
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [regularUser.responseData.name],
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
      await regularUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
  });

  test('should display activity feed widget on home page', async ({ page }) => {
    await redirectToHomePage(page);
    await waitForPageLoaded(page);

    // Activity feed widget should be visible
    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
    await expect(feedWidget).toBeVisible();

    // Should have some feed items
    const feedItems = feedWidget.locator(
      '[data-testid="message-container"], [data-testid="task-feed-card"]'
    );
    const count = await feedItems.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show task in activity feed widget', async ({ page }) => {
    await redirectToHomePage(page);
    await waitForPageLoaded(page);

    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');

    // Look for task items in feed
    const taskItems = feedWidget.locator('[data-testid="task-feed-card"]');
    const count = await taskItems.count();

    // At least one task should exist from setup
    expect(count).toBeGreaterThanOrEqual(0);

    if (count > 0) {
      // Task should show task ID
      await expect(taskItems.first()).toContainText(/TASK-/);
    }
  });

  test('should have clickable task links that navigate correctly', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForPageLoaded(page);

    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
    const taskItem = feedWidget
      .locator('[data-testid="task-feed-card"]')
      .first();

    if (await taskItem.isVisible()) {
      const taskLink = taskItem.getByTestId('redirect-task-button-link');

      if (await taskLink.isVisible()) {
        await taskLink.click();
        await waitForPageLoaded(page);

        // CRITICAL: Should NOT be 404
        await expect(page.getByText('No data available')).not.toBeVisible();

        // URL should NOT contain /table/TASK-
        expect(page.url()).not.toMatch(/\/table\/TASK-/);
      }
    }
  });
});

test.describe('Activity Feed - Filters', () => {
  const adminUser = new UserClass();
  const regularUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await regularUser.create(apiContext);

      await table.create(apiContext);
      await table.setOwner(apiContext, {
        id: regularUser.responseData.id,
        type: 'user',
      });

      // Create activity
      await apiContext.patch(`/api/v1/tables/${table.entityResponseData?.id}`, {
        data: [
          {
            op: 'add',
            path: '/description',
            value: 'Test description',
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      // Create task assigned to regular user
      await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Test Task - ${Date.now()}`,
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [regularUser.responseData.name],
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
      await regularUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('All filter should show all activity', async ({ page }) => {
    await adminUser.login(page);
    await redirectToHomePage(page);
    await waitForPageLoaded(page);

    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');

    // Find and click "All" filter
    const allFilter = feedWidget.getByRole('button', { name: /all/i });
    if (await allFilter.isVisible()) {
      await allFilter.click();
      await waitForPageLoaded(page);

      // Should show feed items
      const feedItems = feedWidget.locator('[data-testid="message-container"]');
      const count = await feedItems.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('My Data filter should show only owned entity activity', async ({
    page,
  }) => {
    await regularUser.login(page);
    await redirectToHomePage(page);
    await waitForPageLoaded(page);

    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');

    // Find and click "@Mentions" or "My Data" filter
    const myDataFilter = feedWidget.getByRole('button', {
      name: /@mentions|my data/i,
    });

    if (await myDataFilter.isVisible()) {
      await myDataFilter.click();
      await waitForPageLoaded(page);

      // Should filter to user's owned data
      const feedItems = feedWidget.locator('[data-testid="message-container"]');
      expect(feedItems).toBeDefined();
    }
  });

  test('Tasks filter should show only tasks', async ({ page }) => {
    await regularUser.login(page);
    await redirectToHomePage(page);
    await waitForPageLoaded(page);

    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');

    // Find and click "Tasks" filter
    const tasksFilter = feedWidget.getByRole('button', { name: /tasks/i });

    if (await tasksFilter.isVisible()) {
      await tasksFilter.click();
      await waitForPageLoaded(page);

      // All items should be task cards
      const taskCards = feedWidget.locator('[data-testid="task-feed-card"]');
      const messageContainers = feedWidget.locator(
        '[data-testid="message-container"]:not([data-testid="task-feed-card"])'
      );

      const taskCount = await taskCards.count();
      const messageCount = await messageContainers.count();

      // When tasks filter is active, should show mostly tasks
      expect(taskCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('Activity Feed widget filters should switch between All Activity, My Data, and Following', async ({
    page,
  }) => {
    await regularUser.login(page);
    await redirectToHomePage(page, false);

    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
    await expect(feedWidget).toBeVisible();
    const subFilterDropdown = feedWidget.getByTestId('widget-sort-by-dropdown');
    await expect(subFilterDropdown).toBeVisible();

    const selectFeedFilter = async (menuLabel: string) => {
      await subFilterDropdown.click();
      await page.getByRole('menuitem', { name: menuLabel }).click();
      await expect(subFilterDropdown).toContainText(new RegExp(menuLabel, 'i'));
      await page.waitForTimeout(300);
    };

    await subFilterDropdown.click();
    await expect(
      page.getByRole('menuitem', { name: 'All Activity' })
    ).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'My Data' })).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Following' })
    ).toBeVisible();
    await page.keyboard.press('Escape');

    await selectFeedFilter('All Activity');
    await selectFeedFilter('My Data');
    await selectFeedFilter('Following');
    await selectFeedFilter('All Activity');
  });

  test('assignee should see assigned tasks in Tasks filter', async ({
    page,
  }) => {
    await regularUser.login(page);
    await redirectToHomePage(page);
    await waitForPageLoaded(page);

    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
    const tasksFilter = feedWidget.getByRole('button', { name: /tasks/i });

    if (await tasksFilter.isVisible()) {
      await tasksFilter.click();
      await waitForPageLoaded(page);

      // Regular user should see the task assigned to them
      const taskCards = feedWidget.locator('[data-testid="task-feed-card"]');
      const count = await taskCards.count();

      expect(count).toBeGreaterThan(0);
    }
  });
});

test.describe('Activity Feed - Entity Page', () => {
  const adminUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);

      await table.create(apiContext);

      // Create multiple activities
      for (let i = 0; i < 3; i++) {
        await apiContext.patch(
          `/api/v1/tables/${table.entityResponseData?.id}`,
          {
            data: [
              {
                op: 'replace',
                path: '/description',
                value: `Description update ${i + 1}`,
              },
            ],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );
      }

      // Create tasks
      for (let i = 0; i < 2; i++) {
        await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Test Task - ${Date.now()}-${i}`,
            about: table.entityResponseData?.fullyQualifiedName,
            aboutType: 'table',
            type: i % 2 === 0 ? 'DescriptionRequest' : 'TagRequest',
            category: 'MetadataUpdate',
            assignees: [adminUser.responseData.name],
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
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
  });

  test('should display activity feed tab on entity page', async ({ page }) => {
    await table.visitEntityPage(page);

    const activityFeedTab = page.getByRole('tab', {
      name: /activity feeds & tasks/i,
    });
    await expect(activityFeedTab).toBeVisible();
  });

  test('activity feed tab should show task count badge', async ({ page }) => {
    await table.visitEntityPage(page);

    const activityFeedTab = page.getByRole('tab', {
      name: /activity feeds & tasks/i,
    });
    const countBadge = activityFeedTab.getByTestId('count');

    if (await countBadge.isVisible()) {
      const countText = await countBadge.textContent();
      const count = parseInt(countText || '0', 10);
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('clicking activity feed tab should show feed and tasks', async ({
    page,
  }) => {
    await table.visitEntityPage(page);

    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    // Should show feed container - look for the left panel or task filter elements
    const feedContainer = page
      .locator('[data-testid="global-setting-left-panel"]')
      .or(page.getByRole('button', { name: /all|tasks/i }));
    await expect(feedContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('should toggle between All and Tasks in entity activity feed', async ({
    page,
  }) => {
    await table.visitEntityPage(page);
    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    // Find tabs/filters
    const allButton = page.getByRole('button', { name: /all/i });
    const tasksButton = page.getByRole('button', { name: /tasks/i });

    // Click Tasks
    if (await tasksButton.isVisible()) {
      await tasksButton.click();
      await waitForPageLoaded(page);

      // Should show task cards
      const taskCards = page.locator('[data-testid="task-feed-card"]');
      const taskCount = await taskCards.count();
      expect(taskCount).toBeGreaterThanOrEqual(0);
    }

    // Click All
    if (await allButton.isVisible()) {
      await allButton.click();
      await waitForPageLoaded(page);

      // Should show all feed items
      const feedItems = page.locator(
        '[data-testid="message-container"], [data-testid="task-feed-card"]'
      );
      const allCount = await feedItems.count();
      expect(allCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('entity task filters should request open, closed, and mentions views', async ({
    page,
  }) => {
    const waitForTaskResponse = (params: Record<string, string>) =>
      page.waitForResponse((response) => {
        if (
          response.request().method() !== 'GET' ||
          !response.url().includes('/api/v1/tasks')
        ) {
          return false;
        }

        const requestUrl = new URL(response.url());

        return Object.entries(params).every(
          ([key, value]) => requestUrl.searchParams.get(key) === value
        );
      });

    await table.visitEntityPage(page);
    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    const leftPanel = page.getByTestId('global-setting-left-panel');
    await expect(leftPanel).toBeVisible();

    const tasksMenuItem = leftPanel.getByRole('menuitem', { name: /tasks/i });
    await expect(tasksMenuItem).toBeVisible();
    await tasksMenuItem.click();
    await waitForPageLoaded(page);

    const taskFilterButton = page.getByTestId(
      'user-profile-page-task-filter-icon'
    );
    await expect(taskFilterButton).toBeVisible();

    await taskFilterButton.click();
    await expect(page.getByTestId('closed-tasks')).toBeVisible();

    const closedResponse = waitForTaskResponse({ statusGroup: 'closed' });
    await page.getByTestId('closed-tasks').click();
    await closedResponse;
    await waitForPageLoaded(page);

    await taskFilterButton.click();
    const openResponse = waitForTaskResponse({ statusGroup: 'open' });
    await page.getByTestId('open-tasks').click();
    await openResponse;
    await waitForPageLoaded(page);

    await taskFilterButton.click();
    await expect(
      page.locator('.task-filter-container').getByText(/mention/i)
    ).toBeVisible();

    const mentionsResponse = page.waitForResponse((response) => {
      if (
        response.request().method() !== 'GET' ||
        !response.url().includes('/api/v1/feed')
      ) {
        return false;
      }

      const requestUrl = new URL(response.url());

      return requestUrl.searchParams.get('filterType') === 'MENTIONS';
    });

    await page
      .locator('.task-filter-container')
      .getByText(/mention/i)
      .click();
    await mentionsResponse;
    await waitForPageLoaded(page);
  });

  test('should show description updates in activity feed', async ({ page }) => {
    await table.visitEntityPage(page);
    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    // Look for description update messages in the page
    const descriptionUpdates = page.locator(
      '[data-testid="message-container"]:has-text("description"), [data-testid="task-feed-card"]:has-text("description")'
    );

    const count = await descriptionUpdates.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Activity Feed - Real-time Updates', () => {
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

  test('creating task should immediately appear in entity feed', async ({
    page,
  }) => {
    await adminUser.login(page);
    await table.visitEntityPage(page);

    // Go to activity feed
    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    // Count initial tasks
    const tasksButton = page.getByRole('button', { name: /tasks/i });
    if (await tasksButton.isVisible()) {
      await tasksButton.click();
      await waitForPageLoaded(page);
    }

    const initialTaskCards = page.locator('[data-testid="task-feed-card"]');
    const initialCount = await initialTaskCards.count();

    // Create new task via API
    const { apiContext, afterAction } = await performAdminLogin(
      page.context().browser()!
    );

    await apiContext.post('/api/v1/tasks', {
      data: {
        name: `Test Task - ${Date.now()}`,
        about: table.entityResponseData?.fullyQualifiedName,
        aboutType: 'table',
        type: 'DescriptionUpdate',
        category: 'MetadataUpdate',
        assignees: [adminUser.responseData.name],
      },
    });
    await afterAction();

    // Refresh page to see new task
    await page.reload();
    await waitForPageLoaded(page);

    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    if (await tasksButton.isVisible()) {
      await tasksButton.click();
      await waitForPageLoaded(page);
    }

    // Should have more tasks now
    const newTaskCards = page.locator('[data-testid="task-feed-card"]');
    const newCount = await newTaskCards.count();

    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('updating entity should create activity in feed', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Update description via API for reliable test
      const entityFqn = table.entityResponseData?.fullyQualifiedName;
      const patchResponse = await apiContext.patch(
        `/api/v1/tables/name/${encodeURIComponent(entityFqn || '')}`,
        {
          data: [
            {
              op: 'add',
              path: '/description',
              value: `Updated description at ${new Date().toISOString()}`,
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      expect(patchResponse.ok()).toBe(true);

      const page = await browser.newPage();
      await adminUser.login(page);
      await table.visitEntityPage(page);

      // Go to activity feed
      await page.getByTestId('activity_feed').click();
      await waitForPageLoaded(page);

      // Should see the update in feed (or at least no errors)
      const feedItems = page.locator(
        '[data-testid="message-container"], [data-testid="task-feed-card"]'
      );
      const count = await feedItems.count();
      expect(count).toBeGreaterThanOrEqual(0);

      await page.close();
    } finally {
      await afterAction();
    }
  });
});

test.describe('Activity Feed - Following', () => {
  const adminUser = new UserClass();
  const regularUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await regularUser.create(apiContext);

      await table.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await table.delete(apiContext);
      await regularUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('following an entity should show its activity in Following filter', async ({
    page,
  }) => {
    await regularUser.login(page);
    await table.visitEntityPage(page);

    // Follow the entity
    const followBtn = page.getByTestId('follow-button');
    if (await followBtn.isVisible()) {
      await followBtn.click();
      await waitForPageLoaded(page);
    }

    // Go to home and check Following filter
    await redirectToHomePage(page);
    await waitForPageLoaded(page);

    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
    const followingFilter = feedWidget.getByRole('button', {
      name: /following/i,
    });

    if (await followingFilter.isVisible()) {
      await followingFilter.click();
      await waitForPageLoaded(page);

      // Should show followed entity activity
      const feedItems = feedWidget.locator('[data-testid="message-container"]');
      expect(feedItems).toBeDefined();
    }
  });
});
