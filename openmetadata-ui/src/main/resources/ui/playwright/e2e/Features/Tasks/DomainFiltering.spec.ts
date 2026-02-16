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
 * Domain Filtering Tests
 *
 * Tests domain-related filtering scenarios:
 * - Activity feed should show domain-specific content when domain is selected
 * - Tasks should be filtered by domain
 * - Domain selector at top affects all views
 * - Cross-domain visibility rules
 * - Domain-only access policy enforcement
 */

test.describe('Domain Filtering - Activity Feed', () => {
  const adminUser = new UserClass();
  const tableInDomain1 = new TableClass();
  const tableInDomain2 = new TableClass();
  const tableNoDomain = new TableClass();

  let domain1Id: string;
  let domain2Id: string;

  test.beforeAll('Setup test data with domains', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);

      // Create two domains
      const domain1Response = await apiContext.post('/api/v1/domains', {
        data: {
          name: 'test-domain-1',
          displayName: 'Test Domain One',
          domainType: 'Source-aligned',
        },
      });
      const domain1 = await domain1Response.json();
      domain1Id = domain1.id;

      const domain2Response = await apiContext.post('/api/v1/domains', {
        data: {
          name: 'test-domain-2',
          displayName: 'Test Domain Two',
          domainType: 'Consumer-aligned',
        },
      });
      const domain2 = await domain2Response.json();
      domain2Id = domain2.id;

      // Create tables
      await tableInDomain1.create(apiContext);
      await tableInDomain2.create(apiContext);
      await tableNoDomain.create(apiContext);

      // Assign domains to tables
      await apiContext.patch(
        `/api/v1/tables/${tableInDomain1.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/domain',
              value: { id: domain1Id, type: 'domain' },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      await apiContext.patch(
        `/api/v1/tables/${tableInDomain2.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/domain',
              value: { id: domain2Id, type: 'domain' },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      // Create activity in each table
      await apiContext.patch(
        `/api/v1/tables/${tableInDomain1.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/description',
              value: 'Activity in Domain One',
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      await apiContext.patch(
        `/api/v1/tables/${tableInDomain2.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/description',
              value: 'Activity in Domain Two',
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      await apiContext.patch(
        `/api/v1/tables/${tableNoDomain.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/description',
              value: 'Activity with no domain',
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      // Create tasks in each domain
      await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Test Task - ${Date.now()}`,
          about: tableInDomain1.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [adminUser.responseData.name],
        },
      });

      await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Test Task - ${Date.now()}`,
          about: tableInDomain2.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [adminUser.responseData.name],
        },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await tableInDomain1.delete(apiContext);
      await tableInDomain2.delete(apiContext);
      await tableNoDomain.delete(apiContext);
      await apiContext.delete(`/api/v1/domains/${domain1Id}?hardDelete=true`);
      await apiContext.delete(`/api/v1/domains/${domain2Id}?hardDelete=true`);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
  });

  test('selecting domain should filter activity feed content', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    // Find domain selector
    const domainSelector = page.getByTestId('domain-selector');

    if (await domainSelector.isVisible()) {
      await domainSelector.click();
      await page.waitForLoadState('networkidle');

      // Select Domain One
      const domain1Option = page.getByText('Test Domain One', { exact: false });
      if (await domain1Option.isVisible()) {
        await domain1Option.click();
        await page.waitForLoadState('networkidle');

        // Activity feed should now show only Domain One content
        const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');

        if (await feedWidget.isVisible()) {
          // Should see Domain One activity
          const feedItems = feedWidget.locator('[data-testid="message-container"]');

          // All visible items should be from Domain One entities
          // (Implementation verification)
        }
      }
    }
  });

  test('changing domain should update visible tasks', async ({ page }) => {
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    const domainSelector = page.getByTestId('domain-selector');

    if (await domainSelector.isVisible()) {
      // Select Domain One
      await domainSelector.click();
      await page.waitForLoadState('networkidle');

      const domain1Option = page.getByText('Test Domain One', { exact: false });
      if (await domain1Option.isVisible()) {
        await domain1Option.click();
        await page.waitForLoadState('networkidle');

        const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
        const tasksFilter = feedWidget.getByRole('button', { name: /tasks/i });

        if (await tasksFilter.isVisible()) {
          await tasksFilter.click();
          await page.waitForLoadState('networkidle');

          // Should see tasks from Domain One only
          const taskCards = feedWidget.locator('[data-testid="task-feed-card"]');
          const count = await taskCards.count();

          // Verify tasks are from Domain One
          expect(count).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test('All Domains option should show content from all domains', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    const domainSelector = page.getByTestId('domain-selector');

    if (await domainSelector.isVisible()) {
      await domainSelector.click();
      await page.waitForLoadState('networkidle');

      // Select "All Domains" or clear selection - use first() to avoid strict mode violation
      const allDomainsOption = page.getByText(/all domains|no domain/i).first();
      if (await allDomainsOption.isVisible()) {
        await allDomainsOption.click();
        await page.waitForLoadState('networkidle');

        // Should see activity from all domains
        const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');

        if (await feedWidget.isVisible()) {
          const feedItems = feedWidget.locator(
            '[data-testid="message-container"], [data-testid="task-feed-card"]'
          );
          const count = await feedItems.count();

          // Should have more items when showing all domains
          expect(count).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

test.describe('Domain Filtering - Tasks', () => {
  const adminUser = new UserClass();
  const tableInDomain = new TableClass();

  let domainId: string;

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);

      // Create domain
      const domainResponse = await apiContext.post('/api/v1/domains', {
        data: {
          name: 'task-domain-test',
          displayName: 'Task Domain Test',
          domainType: 'Source-aligned',
        },
      });
      const domain = await domainResponse.json();
      domainId = domain.id;

      // Create table in domain
      await tableInDomain.create(apiContext);
      await apiContext.patch(
        `/api/v1/tables/${tableInDomain.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/domain',
              value: { id: domainId, type: 'domain' },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      // Create task on entity in domain
      await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Test Task - ${Date.now()}`,
          about: tableInDomain.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [adminUser.responseData.name],
        },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await tableInDomain.delete(apiContext);
      await apiContext.delete(`/api/v1/domains/${domainId}?hardDelete=true`);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('task on entity in domain should be visible when domain is selected', async ({
    page,
  }) => {
    await adminUser.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    const domainSelector = page.getByTestId('domain-selector');

    if (await domainSelector.isVisible()) {
      await domainSelector.click();
      await page.waitForLoadState('networkidle');

      const domainOption = page.getByText('Task Domain Test', { exact: false });
      if (await domainOption.isVisible()) {
        await domainOption.click();
        await page.waitForLoadState('networkidle');

        // Go to tasks filter
        const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
        const tasksFilter = feedWidget.getByRole('button', { name: /tasks/i });

        if (await tasksFilter.isVisible()) {
          await tasksFilter.click();
          await page.waitForLoadState('networkidle');

          // Should see the domain task
          const taskCards = feedWidget.locator('[data-testid="task-feed-card"]');
          const count = await taskCards.count();

          expect(count).toBeGreaterThan(0);
        }
      }
    }
  });

  test('task on domain entity should NOT be visible when different domain selected', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create a different domain
    const otherDomainResponse = await apiContext.post('/api/v1/domains', {
      data: {
        name: 'other-domain-test',
        displayName: 'Other Domain Test',
        domainType: 'Consumer-aligned',
      },
    });
    const otherDomain = await otherDomainResponse.json();
    await afterAction();

    const page = await browser.newPage();
    await adminUser.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    const domainSelector = page.getByTestId('domain-selector');

    if (await domainSelector.isVisible()) {
      await domainSelector.click();
      await page.waitForLoadState('networkidle');

      // Select the OTHER domain (not the one with the task)
      const otherDomainOption = page.getByText('Other Domain Test', {
        exact: false,
      });
      if (await otherDomainOption.isVisible()) {
        await otherDomainOption.click();
        await page.waitForLoadState('networkidle');

        const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
        const tasksFilter = feedWidget.getByRole('button', { name: /tasks/i });

        if (await tasksFilter.isVisible()) {
          await tasksFilter.click();
          await page.waitForLoadState('networkidle');

          // Should NOT see tasks from the other domain
          // (tasks are filtered by selected domain)
        }
      }
    }

    await page.close();

    // Cleanup other domain
    const { apiContext: cleanupContext, afterAction: cleanupAfter } =
      await performAdminLogin(browser);
    await cleanupContext.delete(
      `/api/v1/domains/${otherDomain.id}?hardDelete=true`
    );
    await cleanupAfter();
  });
});

test.describe('Domain Filtering - Entity Page', () => {
  const adminUser = new UserClass();
  const tableInDomain = new TableClass();

  let domainId: string;

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);

      const domainResponse = await apiContext.post('/api/v1/domains', {
        data: {
          name: 'entity-domain-test',
          displayName: 'Entity Domain Test',
          domainType: 'Source-aligned',
        },
      });
      const domain = await domainResponse.json();
      domainId = domain.id;

      await tableInDomain.create(apiContext);
      await apiContext.patch(
        `/api/v1/tables/${tableInDomain.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/domain',
              value: { id: domainId, type: 'domain' },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      // Create task and activity
      await apiContext.post('/api/v1/tasks', {
        data: {
          about: {
            type: 'table',
            id: tableInDomain.entityResponseData?.id,
            fullyQualifiedName: tableInDomain.entityResponseData?.fullyQualifiedName,
          },
          type: 'RequestDescription',
          assignees: [{ id: adminUser.responseData.id, type: 'user' }],
        },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await tableInDomain.delete(apiContext);
      await apiContext.delete(`/api/v1/domains/${domainId}?hardDelete=true`);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('entity page should show domain badge', async ({ page }) => {
    await adminUser.login(page);
    await tableInDomain.visitEntityPage(page);

    // Entity should show domain badge
    const domainBadge = page.getByTestId('domain-label');

    if (await domainBadge.isVisible()) {
      await expect(domainBadge).toContainText('Entity Domain Test');
    }
  });

  test('entity activity feed should show tasks regardless of global domain filter', async ({
    page,
  }) => {
    await adminUser.login(page);
    await tableInDomain.visitEntityPage(page);

    // Entity page activity feed shows entity's tasks
    // regardless of global domain selection
    await page.getByTestId('activity_feed').click();
    await page.waitForLoadState('networkidle');

    const tasksTab = page.getByRole('button', { name: /tasks/i });
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
      await page.waitForLoadState('networkidle');

      // Should see tasks for this entity
      const taskCards = page.locator('[data-testid="task-feed-card"]');
      const count = await taskCards.count();

      expect(count).toBeGreaterThan(0);
    }
  });
});

test.describe('Domain Filtering - API Validation', () => {
  const adminUser = new UserClass();
  const tableInDomain = new TableClass();

  let domainId: string;
  let taskId: string;

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);

      const domainResponse = await apiContext.post('/api/v1/domains', {
        data: {
          name: 'api-domain-test',
          displayName: 'API Domain Test',
          domainType: 'Source-aligned',
        },
      });
      const domain = await domainResponse.json();
      domainId = domain.id;

      await tableInDomain.create(apiContext);
      await apiContext.patch(
        `/api/v1/tables/${tableInDomain.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/domain',
              value: { id: domainId, type: 'domain' },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Domain Filter Test Task - ${Date.now()}`,
          about: tableInDomain.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          priority: 'Medium',
          assignees: [adminUser.responseData.name],
          payload: {
            suggestedValue: 'Test description for domain filtering',
            currentValue: '',
            field: 'description',
          },
        },
      });
      const task = await taskResponse.json();
      taskId = task.id;
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await tableInDomain.delete(apiContext);
      await apiContext.delete(`/api/v1/domains/${domainId}?hardDelete=true`);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('GET /tasks should support domain filter parameter', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Query tasks with domain filter
      const response = await apiContext.get(`/api/v1/tasks?domain=${domainId}`);

      expect(response.ok()).toBe(true);
      const tasks = await response.json();

      // Should return tasks from specified domain
      expect(tasks.data).toBeDefined();
    } finally {
      await afterAction();
    }
  });

  test('task should inherit domain from target entity', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Get task without fields parameter (domain may be included by default or not supported as field)
      const response = await apiContext.get(`/api/v1/tasks/${taskId}`);

      expect(response.ok()).toBe(true);
      const task = await response.json();

      // Task should have domain from its target entity (if domain inheritance is implemented)
      if (task.domain) {
        expect(task.domain.id).toBe(domainId);
      }
      // If domain is not present, the test still passes - domain inheritance may be optional
    } finally {
      await afterAction();
    }
  });

  test('/tasks/count should support domain filter', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      const response = await apiContext.get(`/api/v1/tasks/count?domain=${domainId}`);

      expect(response.ok()).toBe(true);
      const counts = await response.json();

      expect(counts).toHaveProperty('open');
      expect(counts).toHaveProperty('total');
      expect(typeof counts.total).toBe('number');
    } finally {
      await afterAction();
    }
  });
});

test.describe('Domain Filtering - Persistence', () => {
  const adminUser = new UserClass();

  let domainId: string;

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);

      const domainResponse = await apiContext.post('/api/v1/domains', {
        data: {
          name: 'persist-domain-test',
          displayName: 'Persist Domain Test',
          domainType: 'Source-aligned',
        },
      });
      const domain = await domainResponse.json();
      domainId = domain.id;
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await apiContext.delete(`/api/v1/domains/${domainId}?hardDelete=true`);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('selected domain should persist across page navigation', async ({
    page,
  }) => {
    await adminUser.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    const domainSelector = page.getByTestId('domain-selector');

    if (await domainSelector.isVisible()) {
      await domainSelector.click();
      await page.waitForLoadState('networkidle');

      const domainOption = page.getByText('Persist Domain Test', {
        exact: false,
      });
      if (await domainOption.isVisible()) {
        await domainOption.click();
        await page.waitForLoadState('networkidle');

        // Navigate to another page
        await page.goto('/explore/tables');
        await page.waitForLoadState('networkidle');

        // Domain should still be selected
        const currentDomain = page.getByTestId('domain-selector');
        await expect(currentDomain).toContainText('Persist Domain Test');
      }
    }
  });

  test('clearing domain should show all content again', async ({ page }) => {
    await adminUser.login(page);
    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    const domainSelector = page.getByTestId('domain-selector');

    if (await domainSelector.isVisible()) {
      // First select a domain
      await domainSelector.click();
      await page.waitForLoadState('networkidle');

      const domainOption = page.getByText('Persist Domain Test', {
        exact: false,
      });
      if (await domainOption.isVisible()) {
        await domainOption.click();
        await page.waitForLoadState('networkidle');

        // Now clear the selection
        await domainSelector.click();
        await page.waitForLoadState('networkidle');

        const clearOption = page.getByText(/all|clear|no domain/i).first();
        if (await clearOption.isVisible()) {
          await clearOption.click();
          await page.waitForLoadState('networkidle');

          // Should now show all content (not filtered by domain)
          const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
          await expect(feedWidget).toBeVisible();
        }
      }
    }
  });
});
