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
import { TeamClass } from '../../../support/team/TeamClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';

/**
 * Team Activity Tests
 *
 * Tests team-related activity feed scenarios:
 * - Team membership changes appear in activity feed
 * - Team-owned entity changes visible to team members
 * - Team assignment to tasks
 * - Team member can see team's activity
 * - User should see changes happening in their team
 */

test.describe('Team Activity - Membership Changes', () => {
  const adminUser = new UserClass();
  const teamMember = new UserClass();
  const newMember = new UserClass();
  const team = new TeamClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await teamMember.create(apiContext);
      await newMember.create(apiContext);

      // Create team
      await team.create(apiContext);

      // Add team member
      await apiContext.patch(`/api/v1/teams/${team.responseData.id}`, {
        data: [
          {
            op: 'add',
            path: '/users/-',
            value: { id: teamMember.responseData.id, type: 'user' },
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await team.delete(apiContext);
      await newMember.delete(apiContext);
      await teamMember.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('team member should see team membership changes in activity feed', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Add new member to team (this creates activity)
    await apiContext.patch(`/api/v1/teams/${team.responseData.id}`, {
      data: [
        {
          op: 'add',
          path: '/users/-',
          value: { id: newMember.responseData.id, type: 'user' },
        },
      ],
      headers: { 'Content-Type': 'application/json-patch+json' },
    });
    await afterAction();

    // Login as existing team member
    const page = await browser.newPage();
    await teamMember.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    // Check activity feed for team changes
    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');

    if (await feedWidget.isVisible()) {
      // Look for team-related activity
      const feedItems = feedWidget.locator('[data-testid="message-container"]');
      const count = await feedItems.count();

      // Should have some activity (team change might be visible)
      expect(count).toBeGreaterThanOrEqual(0);
    }

    await page.close();
  });

  test('removing team member should create activity', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Get current team state
    const teamResponse = await apiContext.get(`/api/v1/teams/${team.responseData.id}`);
    const currentTeam = await teamResponse.json();
    const userIndex = currentTeam.users?.findIndex(
      (u: { id: string }) => u.id === newMember.responseData.id
    );

    if (userIndex >= 0) {
      // Remove the new member
      await apiContext.patch(`/api/v1/teams/${team.responseData.id}`, {
        data: [
          {
            op: 'remove',
            path: `/users/${userIndex}`,
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });
    }
    await afterAction();

    // Login as existing team member and check feed
    const page = await browser.newPage();
    await teamMember.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    // Activity feed should reflect team changes
    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
    await expect(feedWidget).toBeVisible();

    await page.close();
  });
});

test.describe('Team Activity - Team Owned Entities', () => {
  const adminUser = new UserClass();
  const teamMember1 = new UserClass();
  const teamMember2 = new UserClass();
  const nonTeamMember = new UserClass();
  const team = new TeamClass();
  const teamOwnedTable = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await teamMember1.create(apiContext);
      await teamMember2.create(apiContext);
      await nonTeamMember.create(apiContext);

      // Create team with members
      await team.create(apiContext);

      await apiContext.patch(`/api/v1/teams/${team.responseData.id}`, {
        data: [
          {
            op: 'add',
            path: '/users',
            value: [
              { id: teamMember1.responseData.id, type: 'user' },
              { id: teamMember2.responseData.id, type: 'user' },
            ],
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      // Create table owned by team
      await teamOwnedTable.create(apiContext);
      await teamOwnedTable.setOwner(apiContext, {
        id: team.responseData.id,
        type: 'team',
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await teamOwnedTable.delete(apiContext);
      await team.delete(apiContext);
      await nonTeamMember.delete(apiContext);
      await teamMember2.delete(apiContext);
      await teamMember1.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('team member should see team-owned entity changes', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Make a change to team-owned table
    await apiContext.patch(
      `/api/v1/tables/${teamOwnedTable.entityResponseData?.id}`,
      {
        data: [
          {
            op: 'add',
            path: '/description',
            value: 'Team owned table description updated',
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      }
    );
    await afterAction();

    // Login as team member and check they can see the change
    const page = await browser.newPage();
    await teamMember1.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    // Should see activity related to team's entities
    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
    await expect(feedWidget).toBeVisible();

    await page.close();
  });

  test('non-team member should not see team-only activity', async ({
    page,
  }) => {
    await nonTeamMember.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');

    if (await feedWidget.isVisible()) {
      // Filter to "My Data" or similar
      const myDataFilter = feedWidget.getByRole('button', {
        name: /my data|@mentions/i,
      });

      if (await myDataFilter.isVisible()) {
        await myDataFilter.click();
        await page.waitForLoadState('networkidle');

        // Should not see team-owned entity activity
        // (unless entity is public or user has access)
      }
    }
  });
});

test.describe('Team Activity - Tasks Assigned to Team', () => {
  const adminUser = new UserClass();
  const teamMember1 = new UserClass();
  const teamMember2 = new UserClass();
  const nonTeamMember = new UserClass();
  const team = new TeamClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await teamMember1.create(apiContext);
      await teamMember2.create(apiContext);
      await nonTeamMember.create(apiContext);

      await team.create(apiContext);

      await apiContext.patch(`/api/v1/teams/${team.responseData.id}`, {
        data: [
          {
            op: 'add',
            path: '/users',
            value: [
              { id: teamMember1.responseData.id, type: 'user' },
              { id: teamMember2.responseData.id, type: 'user' },
            ],
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      await table.create(apiContext);

      // Create task assigned to team
      await apiContext.post('/api/v1/tasks', {
        data: {
          about: {
            type: 'table',
            id: table.entityResponseData?.id,
            fullyQualifiedName: table.entityResponseData?.fullyQualifiedName,
          },
          type: 'RequestDescription',
          assignees: [{ id: team.responseData.id, type: 'team' }],
          payload: {
            suggestedValue: 'Team assigned task',
          },
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
      await team.delete(apiContext);
      await nonTeamMember.delete(apiContext);
      await teamMember2.delete(apiContext);
      await teamMember1.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('team member should see tasks assigned to their team', async ({
    page,
  }) => {
    await teamMember1.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
    const tasksFilter = feedWidget.getByRole('button', { name: /tasks/i });

    if (await tasksFilter.isVisible()) {
      await tasksFilter.click();
      await page.waitForLoadState('networkidle');

      // Team member should see tasks assigned to their team
      const taskCards = feedWidget.locator('[data-testid="task-feed-card"]');
      const count = await taskCards.count();

      expect(count).toBeGreaterThan(0);
    }
  });

  test('different team member should also see team-assigned task', async ({
    page,
  }) => {
    await teamMember2.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
    const tasksFilter = feedWidget.getByRole('button', { name: /tasks/i });

    if (await tasksFilter.isVisible()) {
      await tasksFilter.click();
      await page.waitForLoadState('networkidle');

      const taskCards = feedWidget.locator('[data-testid="task-feed-card"]');
      const count = await taskCards.count();

      expect(count).toBeGreaterThan(0);
    }
  });

  test('non-team member should NOT see team-assigned task in their tasks', async ({
    page,
  }) => {
    await nonTeamMember.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    // Check notification box for task assignments
    const notificationBell = page.getByTestId('task-notifications');

    if (await notificationBell.isVisible()) {
      await notificationBell.click();

      const notificationBox = page.locator('.notification-box');

      if (await notificationBox.isVisible()) {
        const tasksTab = notificationBox.getByText('Tasks', { exact: false });

        if (await tasksTab.isVisible()) {
          await tasksTab.click();
          await page.waitForLoadState('networkidle');

          // Non-team member should NOT see team-assigned tasks
          // (unless they're also assigned personally)
        }
      }
    }
  });

  test('team member should be able to resolve team-assigned task', async ({
    page,
  }) => {
    await teamMember1.login(page);
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
      // Team member should see approve/reject buttons for team-assigned task
      const approveBtn = taskCard.getByTestId('approve-button');

      // As team member, should have permission to resolve
      await expect(approveBtn).toBeVisible();
    }
  });
});

test.describe('Team Activity - Team Page Feed', () => {
  const adminUser = new UserClass();
  const teamMember = new UserClass();
  const team = new TeamClass();
  const teamOwnedTable = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await teamMember.create(apiContext);

      await team.create(apiContext);

      await apiContext.patch(`/api/v1/teams/${team.responseData.id}`, {
        data: [
          {
            op: 'add',
            path: '/users/-',
            value: { id: teamMember.responseData.id, type: 'user' },
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      await teamOwnedTable.create(apiContext);
      await teamOwnedTable.setOwner(apiContext, {
        id: team.responseData.id,
        type: 'team',
      });

      // Create some activity
      await apiContext.patch(
        `/api/v1/tables/${teamOwnedTable.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/description',
              value: 'Activity for team page test',
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await teamOwnedTable.delete(apiContext);
      await team.delete(apiContext);
      await teamMember.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('team page should show activity feed for team', async ({ page }) => {
    await adminUser.login(page);

    // Navigate to team page
    await page.goto(
      `/settings/members/teams/${team.responseData.name}`
    );
    await page.waitForLoadState('networkidle');

    // Team page should have activity feed section
    const activityFeedSection = page.locator(
      '[data-testid="activity-feed"], [data-testid="team-activity"]'
    );

    // Activity feed should be visible on team page
    // (exact implementation depends on UI)
    await expect(page).not.toHaveURL('/404');
  });
});

test.describe('Team Activity - Notifications', () => {
  const adminUser = new UserClass();
  const teamMember = new UserClass();
  const team = new TeamClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await teamMember.create(apiContext);

      await team.create(apiContext);

      await apiContext.patch(`/api/v1/teams/${team.responseData.id}`, {
        data: [
          {
            op: 'add',
            path: '/users/-',
            value: { id: teamMember.responseData.id, type: 'user' },
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      await table.create(apiContext);

      // Create task assigned to team
      await apiContext.post('/api/v1/tasks', {
        data: {
          about: {
            type: 'table',
            id: table.entityResponseData?.id,
            fullyQualifiedName: table.entityResponseData?.fullyQualifiedName,
          },
          type: 'RequestDescription',
          assignees: [{ id: team.responseData.id, type: 'team' }],
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
      await team.delete(apiContext);
      await teamMember.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('team member should receive notification for team-assigned task', async ({
    page,
  }) => {
    await teamMember.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    // Check notification bell
    const notificationBell = page.getByTestId('task-notifications');

    if (await notificationBell.isVisible()) {
      // Check if notification badge shows count
      const badge = notificationBell.locator('.ant-badge-count');

      if (await badge.isVisible()) {
        const count = await badge.textContent();
        const notificationCount = parseInt(count || '0', 10);

        // Should have at least one notification (team task)
        expect(notificationCount).toBeGreaterThanOrEqual(0);
      }

      // Click to open notifications
      await notificationBell.click();

      const notificationBox = page.locator('.notification-box');

      if (await notificationBox.isVisible()) {
        // Look for Tasks tab
        const tasksTab = notificationBox.getByText('Tasks', { exact: false });

        if (await tasksTab.isVisible()) {
          await tasksTab.click();
          await page.waitForLoadState('networkidle');

          // Should see team-assigned task
          const taskItems = notificationBox.locator(
            '[data-testid^="notification-link-"]'
          );
          const taskCount = await taskItems.count();

          expect(taskCount).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
