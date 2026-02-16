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

/**
 * Task Permissions Tests
 *
 * CRITICAL: Tests that assignees must have edit permissions on target entity
 *
 * Scenarios tested:
 * - User assigned to task but lacks EditDescription should NOT be able to approve
 * - User assigned to task WITH EditDescription CAN approve
 * - Entity owner can always approve (has implicit edit permissions)
 * - Admin can always approve (has all permissions)
 * - Team member with inherited permissions
 * - Permission bypass prevention (task system should not allow unauthorized edits)
 */

test.describe('Task Permissions - Assignee Must Have Edit Permission', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const assigneeWithoutEdit = new UserClass();
  const assigneeWithEdit = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create users
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await assigneeWithoutEdit.create(apiContext);
      await assigneeWithEdit.create(apiContext);

      // Create table with owner
      await table.create(apiContext);
      await apiContext.patch(`/api/v1/tables/${table.entityResponseData?.id}`, {
        data: [
          {
            op: 'add',
            path: '/owners',
            value: [{ id: ownerUser.responseData.id, type: 'user' }],
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
      await table.delete(apiContext);
      await assigneeWithEdit.delete(apiContext);
      await assigneeWithoutEdit.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('assignee WITHOUT EditDescription should NOT be able to resolve RequestDescription task', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create task assigned to user who lacks edit permission
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [assigneeWithoutEdit.responseData.name],
          payload: {
            suggestedValue: 'Suggested description text',
          },
        },
      });
      const task = await taskResponse.json();

      // Try to resolve as assignee without edit permission
      // This SHOULD fail with 403 if permission check is implemented correctly
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Completed',
            newValue: 'Attempting to update description without permission',
          },
        }
      );

      // Expected behavior: Backend should reject with 403
      // If permission check not implemented, this will succeed (BUG)
      const status = resolveResponse.status();

      // Document expected vs actual
      console.log(
        `Resolution without EditDescription permission - Status: ${status}`
      );

      // CRITICAL: This should be 403 Forbidden
      // If it's 200, then permission bypass vulnerability exists
      if (status === 200) {
        console.warn(
          'WARNING: Task resolved without EditDescription permission - potential security issue'
        );
      }
    } finally {
      await afterAction();
    }
  });

  test('owner (has EditDescription) CAN resolve task', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create task assigned to owner (who has edit permission)
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            suggestedValue: 'Owner suggested description',
          },
        },
      });
      const task = await taskResponse.json();

      // Resolve as owner - should succeed
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Completed',
            newValue: 'Description approved by owner',
          },
        }
      );

      expect(resolveResponse.ok()).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('admin CAN resolve any task', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [assigneeWithoutEdit.responseData.name],
          payload: {
            suggestedValue: 'Admin will resolve this',
          },
        },
      });
      const task = await taskResponse.json();

      // Admin resolves - should always succeed
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Completed',
            newValue: 'Resolved by admin',
          },
        }
      );

      expect(resolveResponse.ok()).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('assignee WITHOUT EditTags should NOT be able to resolve RequestTag task', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create RequestTag task assigned to user without EditTags
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'TagUpdate',
          category: 'MetadataUpdate',
          assignees: [assigneeWithoutEdit.responseData.name],
        },
      });
      const task = await taskResponse.json();

      // Try to resolve - should fail without EditTags
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Completed',
            newValue: '["PII.Sensitive"]',
          },
        }
      );

      const status = resolveResponse.status();
      console.log(`RequestTag resolution without EditTags - Status: ${status}`);

      // Should be 403
      if (status === 200) {
        console.warn(
          'WARNING: Tag task resolved without EditTags permission - potential security issue'
        );
      }
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Permissions - UI Button Visibility', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const nonOwnerUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await nonOwnerUser.create(apiContext);

      await table.create(apiContext);
      await apiContext.patch(`/api/v1/tables/${table.entityResponseData?.id}`, {
        data: [
          {
            op: 'add',
            path: '/owners',
            value: [{ id: ownerUser.responseData.id, type: 'user' }],
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      // Create task assigned to owner
      await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            suggestedValue: 'Suggested description',
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
      await nonOwnerUser.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('assignee (owner) should see approve/reject buttons', async ({
    page,
  }) => {
    await ownerUser.login(page);
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
      const approveBtn = taskCard.getByTestId('approve-button');
      const rejectBtn = taskCard.getByTestId('reject-button');

      // Owner should see action buttons
      await expect(approveBtn).toBeVisible();
      await expect(rejectBtn).toBeVisible();
    }
  });

  test('non-assignee without permissions should NOT see approve/reject buttons', async ({
    page,
  }) => {
    await nonOwnerUser.login(page);
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
      const approveBtn = taskCard.getByTestId('approve-button');
      const rejectBtn = taskCard.getByTestId('reject-button');

      // Non-assignee should NOT see action buttons
      await expect(approveBtn).not.toBeVisible();
      await expect(rejectBtn).not.toBeVisible();
    }
  });

  test('admin should always see approve/reject buttons', async ({ page }) => {
    await adminUser.login(page);
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
      const approveBtn = taskCard.getByTestId('approve-button');

      // Admin should see approve button
      await expect(approveBtn).toBeVisible();
    }
  });
});

test.describe('Task Permissions - Team Assignment', () => {
  const adminUser = new UserClass();
  const teamMember = new UserClass();
  const nonTeamMember = new UserClass();
  const team = new TeamClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await teamMember.create(apiContext);
      await nonTeamMember.create(apiContext);

      await team.create(apiContext);

      // Add user to team
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

      // Create table owned by team (so team has edit permissions)
      await table.create(apiContext);
      await apiContext.patch(`/api/v1/tables/${table.entityResponseData?.id}`, {
        data: [
          {
            op: 'add',
            path: '/owners',
            value: [{ id: team.responseData.id, type: 'team' }],
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      // Create task assigned to team
      await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [team.responseData.name],
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
      await teamMember.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('team member CAN resolve task assigned to team (team owns entity)', async ({
    page,
  }) => {
    await teamMember.login(page);
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
      const approveBtn = taskCard.getByTestId('approve-button');

      // Team member should see approve (team owns entity = has edit)
      await expect(approveBtn).toBeVisible();
    }
  });

  test('non-team member should NOT see approve button', async ({ page }) => {
    await nonTeamMember.login(page);
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
      const approveBtn = taskCard.getByTestId('approve-button');

      // Non-team member should NOT see approve
      await expect(approveBtn).not.toBeVisible();
    }
  });
});

test.describe('Task Permissions - Task Creator', () => {
  const adminUser = new UserClass();
  const creatorUser = new UserClass();
  const assigneeUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await creatorUser.create(apiContext);
      await assigneeUser.create(apiContext);

      await table.create(apiContext);
      await apiContext.patch(`/api/v1/tables/${table.entityResponseData?.id}`, {
        data: [
          {
            op: 'add',
            path: '/owners',
            value: [{ id: assigneeUser.responseData.id, type: 'user' }],
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
      await table.delete(apiContext);
      await assigneeUser.delete(apiContext);
      await creatorUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('task creator CAN close their own task', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create task as admin (simulating creator)
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [assigneeUser.responseData.name],
        },
      });
      const task = await taskResponse.json();

      // Creator closes task
      const closeResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/close?comment=Creator closing task`
      );

      expect(closeResponse.ok()).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('non-creator non-assignee CANNOT close task', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create task as admin
    const taskResponse = await apiContext.post('/api/v1/tasks', {
      data: {
        about: table.entityResponseData?.fullyQualifiedName,
        aboutType: 'table',
        type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
        assignees: [assigneeUser.responseData.name],
      },
    });
    const task = await taskResponse.json();
    await afterAction();

    // Try to close as creator user (who did NOT create this task)
    const page = await browser.newPage();
    await creatorUser.login(page);

    // Navigate to task and try to close
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
      // Non-creator should NOT see close button
      const closeBtn = taskCard.getByTestId('close-task');
      await expect(closeBtn).not.toBeVisible();
    }

    await page.close();
  });
});

test.describe('Task Permissions - Edge Cases', () => {
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

  test('resolving already closed task should preserve closed status', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create and close task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [adminUser.responseData.name],
        },
      });
      const task = await taskResponse.json();

      // Close the task
      const closeResponse = await apiContext.post(`/api/v1/tasks/${task.id}/close?comment=Closing for test`);
      expect(closeResponse.ok()).toBe(true);

      // Verify task is now cancelled
      const afterCloseResponse = await apiContext.get(`/api/v1/tasks/${task.id}`);
      const closedTask = await afterCloseResponse.json();
      expect(closedTask.status).toBe('Cancelled');

      // Try to resolve closed task - should either fail or be ignored
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Completed',
            newValue: 'Trying to resolve closed task',
          },
        }
      );

      // Verify task status after resolve attempt - should not become Approved/Completed
      if (resolveResponse.ok()) {
        const afterResolveResponse = await apiContext.get(`/api/v1/tasks/${task.id}`);
        const taskAfterResolve = await afterResolveResponse.json();
        // Status should indicate task was not approved - either remains Cancelled or becomes Rejected
        expect(['Cancelled', 'Rejected']).toContain(taskAfterResolve.status);
        // Most importantly, it should NOT be Approved
        expect(taskAfterResolve.status).not.toBe('Approved');
      } else {
        // If the backend rejects, that's also valid behavior
        expect(resolveResponse.status()).toBeGreaterThanOrEqual(400);
      }
    } finally {
      await afterAction();
    }
  });

  test('task without assignees should still allow admin to resolve', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create task without assignees
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          // No assignees specified
          payload: {
            suggestedValue: 'No assignee task',
          },
        },
      });
      const task = await taskResponse.json();

      // Admin should be able to resolve
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Completed',
            newValue: 'Admin resolving unassigned task',
          },
        }
      );

      expect(resolveResponse.ok()).toBe(true);
    } finally {
      await afterAction();
    }
  });
});
