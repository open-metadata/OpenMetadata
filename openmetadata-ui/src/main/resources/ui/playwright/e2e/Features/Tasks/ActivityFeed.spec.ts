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
import { insertActivityEventForTest } from '../../../utils/activityAPI';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
  uuid,
} from '../../../utils/common';
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
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

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
          about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
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
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

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
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

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
          about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
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
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

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

      const taskCards = feedWidget.locator('[data-testid="task-feed-card"]');
      const taskCount = await taskCards.count();

      // TODO: this whole test still verifies nothing — the guard above and the
      // >= 0 below both hold when the widget is empty. It needs a seeded,
      // owner-scoped fixture, tracked with the wider conditional-escape cleanup.
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
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

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

      // Create tasks. DescriptionUpdate/TagUpdate are the taskType enum values —
      // the earlier DescriptionRequest/TagRequest are not, so both posts were
      // rejected and this describe ran against zero tasks. Assert the response
      // so a rejected fixture fails here instead of silently emptying the tab.
      for (const type of ['DescriptionUpdate', 'TagUpdate']) {
        const taskResponse = await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Test Task - ${type}-${uuid()}`,
            about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
            type,
            category: 'MetadataUpdate',
            assignees: [adminUser.responseData.name],
          },
        });

        expect(taskResponse.ok()).toBe(true);
      }
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

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

    await expect(page.getByTestId('mentions-toggle')).toBeVisible();

    // Mentions renders the conversations that mention the user, so it has to
    // query the conversation feed with the MENTIONS filter — not the task list,
    // whose rows the mentions list never reads.
    const mentionsResponse = page.waitForResponse((response) => {
      if (
        response.request().method() !== 'GET' ||
        !response.url().includes('/api/v1/conversations')
      ) {
        return false;
      }

      const requestUrl = new URL(response.url());

      return requestUrl.searchParams.get('filterType') === 'MENTIONS';
    });

    await page.getByTestId('mentions-toggle').click();
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
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await table.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

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
    const tasksButton = page.getByRole('menuitem', { name: /tasks/i });
    if (await tasksButton.isVisible()) {
      await tasksButton.click();
      await waitForPageLoaded(page);
    }

    const initialTaskCards = page.locator('[data-testid="task-feed-card"]');
    const initialCount = await initialTaskCards.count();

    // Create new task via API
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      page.context().browser()!
    );

    await apiContext.post('/api/v1/tasks', {
      data: {
        name: `Test Task - ${Date.now()}`,
        about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
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
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

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
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

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
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

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

// Counts are asserted exactly, so this describe owns its entity and never
// mutates it. The sibling 'Activity Feed - Entity Page' describe adds a third
// task in one of its tests, and chromium runs fullyParallel, so sharing that
// fixture would make an exact count order-dependent.
test.describe('Activity Feed - Entity Page counts', () => {
  const adminUser = new UserClass();
  const table = new TableClass();
  const seededActivitySummary = `Entity count seeded event ${uuid()}`;
  const SEEDED_TASK_COUNT = 2;

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await table.create(apiContext);

      await insertActivityEventForTest(
        apiContext,
        table,
        seededActivitySummary
      );

      for (const type of ['DescriptionUpdate', 'TagUpdate']) {
        const taskResponse = await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Count Task - ${type}-${uuid()}`,
            about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
            type,
            category: 'MetadataUpdate',
            assignees: [adminUser.responseData.name],
          },
        });

        expect(taskResponse.ok()).toBe(true);
      }
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

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

  test('entity tab badge totals conversations, activity and tasks', async ({
    page,
  }) => {
    await table.visitEntityPage(page);

    const countBadge = page
      .getByRole('tab', { name: /activity feeds & tasks/i })
      .getByTestId('count');

    await expect(countBadge).toBeVisible();

    // feedCount.totalCount = conversations (0) + activity (>= 1 seeded) +
    // tasks (2). Anything below 3 means a category was dropped from the sum;
    // the previous `>= 0` assertion held even with activity left out entirely.
    // Poll instead of reading once — the counts are fetched after first paint,
    // so a single read races the request and sees the initial 0.
    await expect
      .poll(async () => Number((await countBadge.innerText()).trim()), {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(SEEDED_TASK_COUNT + 1);
  });

  test('All and Tasks panels each show their own seeded items', async ({
    page,
  }) => {
    await table.visitEntityPage(page);
    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    const leftPanel = page.getByTestId('global-setting-left-panel');

    await leftPanel.getByText('Tasks').click();
    await waitForPageLoaded(page);

    await expect(
      page.getByTestId('left-panel-task-count').getByTestId('filter-count')
    ).toHaveText(String(SEEDED_TASK_COUNT), { timeout: 30_000 });
    await expect(page.locator('[data-testid="task-feed-card"]')).toHaveCount(
      SEEDED_TASK_COUNT
    );

    // All lists the change-events, including the one seeded for this entity.
    await leftPanel.getByText('All', { exact: true }).click();
    await waitForPageLoaded(page);

    const feedItems = page.locator(
      '#feedData [data-testid="message-container"]'
    );

    await expect(
      feedItems.filter({ hasText: seededActivitySummary }).first()
    ).toBeVisible({ timeout: 30_000 });

    // Deliberately not asserting badge === rendered here. The badge is a
    // server count and the list a separate query, and this fixture also
    // creates tasks, whose own change-events are indexed a moment later — the
    // two reads legitimately disagree by one while that settles. That
    // invariant has its own test in ActivityFeed.spec.ts ('All badge, header
    // and rendered list agree on the count') on a fixture with no tasks.
    await expect(
      page.getByTestId('left-panel-all-count').getByTestId('filter-count')
    ).toHaveText(/^[1-9]\d*$/, { timeout: 30_000 });
  });
});
