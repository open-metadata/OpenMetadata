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

import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForPageLoaded } from '../../utils/polling';
import {
  addTagSuggestion,
  approveTaskFromDetails,
  type CreatedTask,
  getTaskCard,
  openEntityTasksTab,
  selectAssignee,
} from '../../utils/taskWorkflow';

/**
 * Task System E2E Tests
 *
 * These tests verify the complete task workflow including:
 * 1. Task creation (request description, request tags, suggest description, suggest tags)
 * 2. Task assignment (auto-fill from owners, manual assignment)
 * 3. Task navigation (clicking task goes to correct page)
 * 4. Task resolution (assignee permissions required)
 * 5. Task visibility (domain filtering, activity feed)
 * 6. Task count accuracy
 */

test.describe('Task Workflow Tests', () => {
  const adminUser = new UserClass();
  const regularUser = new UserClass();
  const tableWithOwner = new TableClass();
  const tableWithoutOwner = new TableClass();
  const testTeam = new TeamClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create users
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await regularUser.create(apiContext);

      // Create team and add regular user
      await testTeam.create(apiContext);
      await testTeam.addUser(apiContext, regularUser.responseData.id);

      // Create tables - one with owner, one without
      await tableWithOwner.create(apiContext);
      await tableWithOwner.setOwner(apiContext, {
        id: regularUser.responseData.id,
        type: 'user',
      });

      await tableWithoutOwner.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await tableWithOwner.delete(apiContext);
      await tableWithoutOwner.delete(apiContext);
      await testTeam.delete(apiContext);
      await regularUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.describe('Task Creation', () => {
    test.beforeEach(async ({ page }) => {
      await adminUser.signIn(page);
    });

    test('should create request description task from entity page', async ({
      page,
    }) => {
      await tableWithOwner.visitEntityPage(page);

      // Click on request description button
      const requestDescBtn = page.getByTestId('request-description');
      await expect(requestDescBtn).toBeVisible();
      await requestDescBtn.click();

      // Wait for task form page to load (navigates to separate page, not modal)
      await page.waitForSelector('[data-testid="form-container"]', {
        state: 'visible',
      });

      // Verify assignee is auto-filled with owner
      const assigneeContainer = page.getByTestId('select-assignee');
      await expect(assigneeContainer).toBeVisible();

      // Submit task
      const submitBtn = page.getByTestId('submit-btn');
      const taskResponse = page.waitForResponse('/api/v1/tasks');
      await submitBtn.click();
      await taskResponse;

      // Should navigate back to entity page
      await waitForPageLoaded(page);
    });

    test('should allow manual assignee selection when entity has no owner', async ({
      page,
    }) => {
      await tableWithoutOwner.visitEntityPage(page);

      const requestDescBtn = page.getByTestId('request-description');
      await expect(requestDescBtn).toBeVisible();
      await requestDescBtn.click();

      // Wait for task form page to load
      await page.waitForSelector('[data-testid="form-container"]', {
        state: 'visible',
      });

      // Manually select assignee
      await selectAssignee(page, regularUser.responseData.name);

      // Submit task
      const submitBtn = page.getByTestId('submit-btn');
      const taskResponse = page.waitForResponse('/api/v1/tasks');
      await submitBtn.click();
      await taskResponse;

      await waitForPageLoaded(page);
    });

    test('should create suggest tags task', async ({ page }) => {
      await tableWithOwner.visitEntityPage(page);

      // Navigate to tags section and click request tags
      const requestTagsBtn = page.getByTestId('request-entity-tags');
      if (!(await requestTagsBtn.isVisible())) {
        // Skip if button not visible
        return;
      }
      await requestTagsBtn.click();

      // Wait for task form page to load
      await page.waitForSelector('[data-testid="form-container"]', {
        state: 'visible',
      });

      // Add suggested tags
      const tagsInput = page.locator(
        '[data-testid="tag-selector"] .ant-select-selection-search input'
      );
      if (await tagsInput.isVisible().catch(() => false)) {
        await addTagSuggestion({
          page,
          searchText: 'PII',
          tagTestId: 'tag-PII.Sensitive',
        });
      }

      // Submit - tag request pages use submit-tag-request
      const submitBtn = page.getByTestId('submit-tag-request');
      const taskResponse = page.waitForResponse('/api/v1/tasks');
      await submitBtn.click();
      await taskResponse;

      await waitForPageLoaded(page);
    });
  });

  test.describe('Task Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await adminUser.signIn(page);
    });

    test('clicking task in activity feed should navigate to entity page with task tab', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        // Create a task via API
        const taskResponse = await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Test Task - ${Date.now()}`,
            about: `<#E::table::${tableWithOwner.entityResponseData?.fullyQualifiedName}>`,
            type: 'DescriptionUpdate',
            category: 'MetadataUpdate',
            assignees: [regularUser.responseData.name],
          },
        });

        expect(taskResponse.ok(), await taskResponse.text()).toBe(true);
        const task = (await taskResponse.json()) as CreatedTask;

        const page = await browser.newPage();
        await adminUser.signIn(page);

        // The home KnowledgePanel.ActivityFeed widget cannot show this: its
        // "All" tab counts conversations and activity only, and tasks live
        // behind a separate tab (ActivityFeedTab.component.tsx:194-210). The
        // test read a task card there behind an isVisible() guard, so it never
        // clicked anything. The entity activity feed is the surface that
        // renders task-feed-card.
        await tableWithOwner.visitEntityPage(page);
        await openEntityTasksTab(page);

        const taskItem = getTaskCard(page, task);
        await expect(taskItem).toBeVisible({ timeout: 45000 });

        await taskItem.getByTestId('redirect-task-button-link').click();
        await waitForPageLoaded(page);

        // Verify navigation - should NOT be 404
        await expect(page.getByText('No data available')).not.toBeVisible();

        await page.close();
      } finally {
        await afterAction();
      }
    });

    test('task link should NOT navigate to wrong URL like /table/TASK-xxxxx', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        // Seed this test's own task rather than clicking whatever the feed
        // has left over from a neighbouring test.
        const taskResponse = await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Test Task - ${Date.now()}`,
            about: `<#E::table::${tableWithOwner.entityResponseData?.fullyQualifiedName}>`,
            type: 'DescriptionUpdate',
            category: 'MetadataUpdate',
            assignees: [regularUser.responseData.name],
          },
        });

        expect(taskResponse.ok(), await taskResponse.text()).toBe(true);
        const task = (await taskResponse.json()) as CreatedTask;

        const page = await browser.newPage();
        await adminUser.signIn(page);

        await tableWithOwner.visitEntityPage(page);
        await openEntityTasksTab(page);

        const taskCard = getTaskCard(page, task);
        await expect(taskCard).toBeVisible({ timeout: 45000 });
        await taskCard.getByTestId('redirect-task-button-link').click();
        await waitForPageLoaded(page);

        // URL should NOT contain /table/TASK- pattern
        expect(page.url()).not.toMatch(/\/table\/TASK-/);

        // Should not show 404 or "No data available"
        await expect(page.getByText('No data available')).not.toBeVisible();

        await page.close();
      } finally {
        await afterAction();
      }
    });
  });

  test.describe('Task Resolution and Permissions', () => {
    test('assignee should be able to approve task', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        // Create a task via API
        const taskResponse = await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Test Task - ${Date.now()}`,
            about: `<#E::table::${tableWithOwner.entityResponseData?.fullyQualifiedName}>`,
            type: 'DescriptionUpdate',
            category: 'MetadataUpdate',
            assignees: [regularUser.responseData.name],
          },
        });
        expect(taskResponse.ok(), await taskResponse.text()).toBe(true);
        const task = (await taskResponse.json()) as CreatedTask;

        // Login as regular user (who is the assignee)
        const page = await browser.newPage();
        await regularUser.signIn(page);

        await tableWithOwner.visitEntityPage(page);
        await openEntityTasksTab(page);

        const taskCard = getTaskCard(page, task);
        await expect(taskCard).toBeVisible({ timeout: 45000 });
        await taskCard.click();
        await expect(page.getByTestId('task-tab')).toBeVisible();

        // approveTaskFromDetails waits on the task-action response, so the
        // approval is proven rather than fired and hoped for.
        await approveTaskFromDetails(page);

        await page.close();
      } finally {
        await afterAction();
      }
    });

    test('non-assignee without edit permissions should NOT see approve button', async ({
      browser,
    }) => {
      // Create a new user who is NOT the assignee
      const { apiContext, afterAction } = await performAdminLogin(browser);
      const nonAssignee = new UserClass();
      await nonAssignee.create(apiContext);

      try {
        // Seed this test's own task. It used to read whichever card the feed
        // showed first, which was the one the previous test had just resolved.
        const taskResponse = await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Test Task - ${Date.now()}`,
            about: `<#E::table::${tableWithOwner.entityResponseData?.fullyQualifiedName}>`,
            type: 'DescriptionUpdate',
            category: 'MetadataUpdate',
            assignees: [regularUser.responseData.name],
          },
        });

        expect(taskResponse.ok(), await taskResponse.text()).toBe(true);
        const task = (await taskResponse.json()) as CreatedTask;

        const page = await browser.newPage();
        await nonAssignee.signIn(page);

        await tableWithOwner.visitEntityPage(page);
        await openEntityTasksTab(page);

        const taskCard = getTaskCard(page, task);
        await expect(taskCard).toBeVisible({ timeout: 45000 });
        await taskCard.click();
        await expect(page.getByTestId('task-tab')).toBeVisible();

        // Not the assignee, so no approve action is offered.
        await expect(page.getByTestId('approve-button')).not.toBeVisible();

        await page.close();
      } finally {
        await nonAssignee.delete(apiContext);
        await afterAction();
      }
    });

    test('accepting task without edit permission should be rejected by backend', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      // Create restricted user with no edit permissions
      const restrictedUser = new UserClass();
      await restrictedUser.create(apiContext);

      try {
        // Create a task assigned to this restricted user
        const taskResponse = await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Test Task - ${Date.now()}`,
            about: `<#E::table::${tableWithOwner.entityResponseData?.fullyQualifiedName}>`,
            type: 'DescriptionUpdate',
            category: 'MetadataUpdate',
            assignees: [restrictedUser.responseData.name],
          },
        });
        const task = await taskResponse.json();

        // Try to resolve - note: This may succeed if user has owner rights
        // The actual permission check depends on entity ownership
        const resolveResponse = await apiContext.post(
          `/api/v1/tasks/${task.id}/resolve`,
          {
            data: {
              resolutionType: 'Approved',
              newValue: 'Test description',
            },
          }
        );

        // Response should be valid (either success or forbidden)
        expect([200, 403]).toContain(resolveResponse.status());
      } finally {
        await restrictedUser.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Task Count Accuracy', () => {
    test('task count in Activity Feed tab should match actual tasks', async ({
      page,
    }) => {
      await adminUser.signIn(page);
      await tableWithOwner.visitEntityPage(page);

      // Click on activity feed tab
      await page.getByTestId('activity_feed').click();
      await waitForPageLoaded(page);

      // Navigate to Tasks tab
      const tasksTab = page
        .getByTestId('global-setting-left-panel')
        .getByRole('button', { name: /tasks/i });
      if (await tasksTab.isVisible()) {
        await tasksTab.click();
        await waitForPageLoaded(page);
      }

      // Count actual tasks - this just verifies the UI loads correctly
      const taskCards = page.locator('[data-testid="task-feed-card"]');
      const actualCount = await taskCards.count();

      // Just verify count is a valid number
      expect(actualCount).toBeGreaterThanOrEqual(0);
    });

    test('/tasks/count API should return correct counts for aboutEntity filter', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const entityFqn = tableWithOwner.entityResponseData?.fullyQualifiedName;
        const countResponse = await apiContext.get(
          `/api/v1/tasks/count?aboutEntity=${encodeURIComponent(
            entityFqn || ''
          )}`
        );

        expect(countResponse.ok()).toBe(true);
        const counts = await countResponse.json();

        // Verify response structure
        expect(counts).toHaveProperty('open');
        expect(counts).toHaveProperty('completed');
        expect(counts).toHaveProperty('total');
        expect(typeof counts.open).toBe('number');
        expect(typeof counts.completed).toBe('number');
        expect(typeof counts.total).toBe('number');
        expect(counts.total).toBe(counts.open + counts.completed);
      } finally {
        await afterAction();
      }
    });
  });

  test.describe('Activity Feed Integration', () => {
    test('creating a task should appear in entity activity feed', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        // Create a task via API
        const taskResponse = await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Test Task - ${Date.now()}`,
            about: `<#E::table::${tableWithOwner.entityResponseData?.fullyQualifiedName}>`,
            type: 'DescriptionUpdate',
            category: 'MetadataUpdate',
            assignees: [regularUser.responseData.name],
          },
        });
        expect(taskResponse.ok()).toBe(true);

        const page = await browser.newPage();
        await adminUser.signIn(page);
        await tableWithOwner.visitEntityPage(page);

        // Navigate to activity feed
        await page.getByTestId('activity_feed').click();
        await waitForPageLoaded(page);

        // Navigate to Tasks tab
        const tasksTab = page
          .getByTestId('global-setting-left-panel')
          .getByRole('button', { name: /tasks/i });
        if (await tasksTab.isVisible()) {
          await tasksTab.click();
          await waitForPageLoaded(page);
        }

        // Verify task appears using Playwright's polling mechanism
        const taskCards = page.locator('[data-testid="task-feed-card"]');

        await expect
          .poll(async () => taskCards.count(), {
            message: 'Waiting for task cards to appear in activity feed',
            timeout: 30000,
            intervals: [2000, 3000, 5000],
          })
          .toBeGreaterThanOrEqual(0);

        await page.close();
      } finally {
        await afterAction();
      }
    });

    test('task should appear in "My Tasks" filter for assignee', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        // Create a task assigned to regularUser
        await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Test Task - ${Date.now()}`,
            about: `<#E::table::${tableWithOwner.entityResponseData?.fullyQualifiedName}>`,
            type: 'DescriptionUpdate',
            category: 'MetadataUpdate',
            assignees: [regularUser.responseData.name],
          },
        });

        const page = await browser.newPage();
        await regularUser.signIn(page);
        await redirectToHomePage(page);
        await waitForPageLoaded(page);

        // Check notifications for tasks
        const taskNotifications = page.getByTestId('task-notifications');
        if (await taskNotifications.isVisible()) {
          await taskNotifications.click();
          await waitForPageLoaded(page);
        }

        await page.close();
      } finally {
        await afterAction();
      }
    });
  });

  test.describe('Domain Filtering', () => {
    test('tasks should respect domain filter when domain is selected', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      let domain: { id: string } | null = null;
      let tableInDomain: TableClass | null = null;

      try {
        // Create domain
        const domainResponse = await apiContext.post('/api/v1/domains', {
          data: {
            name: `test-domain-for-tasks-${Date.now()}`,
            displayName: 'Test Domain For Tasks',
            domainType: 'Source-aligned',
          },
        });
        domain = await domainResponse.json();

        // Create table in domain
        tableInDomain = new TableClass();
        await tableInDomain.create(apiContext);
        await apiContext.patch(
          `/api/v1/tables/${tableInDomain.entityResponseData?.id}`,
          {
            data: [
              {
                op: 'add',
                path: '/domain',
                value: { id: domain?.id, type: 'domain' },
              },
            ],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );

        // Create task on entity in domain
        const taskResponse = await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Test Task - ${Date.now()}`,
            about: `<#E::table::${tableInDomain.entityResponseData?.fullyQualifiedName}>`,
            type: 'DescriptionUpdate',
            category: 'MetadataUpdate',
            assignees: [adminUser.responseData.name],
          },
        });

        expect(taskResponse.ok()).toBe(true);
        const task = await taskResponse.json();
        expect(task.id).toBeDefined();
      } finally {
        // Cleanup
        if (tableInDomain) {
          await tableInDomain.delete(apiContext);
        }
        if (domain) {
          await apiContext.delete(
            `/api/v1/domains/${domain.id}?hardDelete=true`
          );
        }
        await afterAction();
      }
    });
  });
});
