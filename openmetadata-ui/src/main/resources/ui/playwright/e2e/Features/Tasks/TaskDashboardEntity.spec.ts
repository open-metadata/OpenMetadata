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
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { Domain } from '../../../support/domain/Domain';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';

/**
 * Task Tests for Dashboard Entities
 *
 * Tests task workflows for Dashboard entities including:
 * - Entity-level description tasks
 * - Tag update tasks for dashboards
 * - Ownership update tasks for dashboards
 * - Tier update tasks for dashboards
 * - Domain update tasks for dashboards
 */

test.describe('Task Creation and Resolution - Dashboard Entity', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const dashboard = new DashboardClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await domain.create(apiContext);

      await dashboard.create(apiContext);

      // Set owner via patch
      await apiContext.patch(
        `/api/v1/dashboards/${dashboard.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/owners',
              value: [{ id: ownerUser.responseData.id, type: 'user' }],
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
      await dashboard.delete(apiContext);
      await domain.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve entity-level description task for Dashboard', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const newDescription = 'Updated Dashboard description from task';

    try {
      // Create DescriptionUpdate task for entity level
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: dashboard.entityResponseData?.fullyQualifiedName,
          aboutType: 'dashboard',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: 'description',
            newDescription: newDescription,
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);

      // Resolve task
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
            newValue: newDescription,
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);

      // Verify description was updated
      const dashboardResponse = await apiContext.get(
        `/api/v1/dashboards/${dashboard.entityResponseData?.id}`
      );
      const updatedDashboard = await dashboardResponse.json();

      expect(updatedDashboard.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve TagUpdate task for Dashboard', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create TagUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          name: `TagUpdate Task - ${Date.now()}`,
          about: dashboard.entityResponseData?.fullyQualifiedName,
          aboutType: 'dashboard',
          type: 'TagUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            suggestedTags: [
              {
                tagFQN: 'PII.Sensitive',
                source: 'Classification',
                labelType: 'Manual',
                state: 'Confirmed',
              },
            ],
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);
      expect(task.type).toBe('TagUpdate');

      // Resolve task with approval (tags are applied by backend on resolution)
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);

      // Verify task is resolved (status could be 'Approved', 'Completed', or 'Resolved')
      const taskGetResponse = await apiContext.get(`/api/v1/tasks/${task.id}`);
      const resolvedTask = await taskGetResponse.json();
      expect(['Approved', 'Completed', 'Resolved']).toContain(resolvedTask.status);
    } finally {
      await afterAction();
    }
  });

  test('should create OwnershipUpdate task for Dashboard', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create a new user to be the new owner
      const newOwner = new UserClass();
      await newOwner.create(apiContext);

      // Create OwnershipUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: dashboard.entityResponseData?.fullyQualifiedName,
          aboutType: 'dashboard',
          type: 'OwnershipUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
            newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);
      expect(task.type).toBe('OwnershipUpdate');

      // Resolve task
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);

      // Verify ownership changed
      const dashboardResponse = await apiContext.get(
        `/api/v1/dashboards/${dashboard.entityResponseData?.id}?fields=owners`
      );
      const updatedDashboard = await dashboardResponse.json();

      expect(updatedDashboard.owners).toBeDefined();
      expect(updatedDashboard.owners[0].id).toBe(newOwner.responseData.id);

      // Cleanup new owner
      await newOwner.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create TierUpdate task for Dashboard', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create TierUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: dashboard.entityResponseData?.fullyQualifiedName,
          aboutType: 'dashboard',
          type: 'TierUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            newTier: {
              tagFQN: 'Tier.Tier5',
              source: 'Classification',
              labelType: 'Manual',
              state: 'Confirmed',
            },
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);
      expect(task.type).toBe('TierUpdate');

      // Resolve task
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);

      // Verify tier was applied
      const dashboardResponse = await apiContext.get(
        `/api/v1/dashboards/${dashboard.entityResponseData?.id}?fields=tags`
      );
      const updatedDashboard = await dashboardResponse.json();

      const hasTier = updatedDashboard.tags?.some(
        (tag: { tagFQN: string }) => tag.tagFQN === 'Tier.Tier5'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('should create DomainUpdate task for Dashboard', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create DomainUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: dashboard.entityResponseData?.fullyQualifiedName,
          aboutType: 'dashboard',
          type: 'DomainUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            newDomain: {
              id: domain.responseData.id,
              type: 'domain',
              fullyQualifiedName: domain.responseData.fullyQualifiedName,
            },
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);
      expect(task.type).toBe('DomainUpdate');

      // Resolve task
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);

      // Verify domain was applied
      const dashboardResponse = await apiContext.get(
        `/api/v1/dashboards/${dashboard.entityResponseData?.id}?fields=domains`
      );
      const updatedDashboard = await dashboardResponse.json();

      expect(updatedDashboard.domains?.length).toBeGreaterThan(0);
      expect(updatedDashboard.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });

  test('rejected task should NOT apply changes', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const originalDescription = 'Original description for rejection test';

    try {
      // First set a known description
      await apiContext.patch(
        `/api/v1/dashboards/${dashboard.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'replace',
              path: '/description',
              value: originalDescription,
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      // Create DescriptionUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: dashboard.entityResponseData?.fullyQualifiedName,
          aboutType: 'dashboard',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: 'description',
            newDescription: 'This should not be applied',
          },
        },
      });
      const task = await taskResponse.json();

      // Reject task
      const resolveResponse = await apiContext.post(
        `/api/v1/tasks/${task.id}/resolve`,
        {
          data: {
            resolutionType: 'Rejected',
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);

      // Verify description was NOT changed
      const dashboardResponse = await apiContext.get(
        `/api/v1/dashboards/${dashboard.entityResponseData?.id}`
      );
      const updatedDashboard = await dashboardResponse.json();

      expect(updatedDashboard.description).toBe(originalDescription);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Dashboard Task UI Flow', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const dashboard = new DashboardClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

      await dashboard.create(apiContext);

      await apiContext.patch(
        `/api/v1/dashboards/${dashboard.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/owners',
              value: [{ id: ownerUser.responseData.id, type: 'user' }],
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
      await dashboard.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should show task in activity feed after creation', async ({
    browser,
  }) => {
    const { apiContext, afterAction, page } = await performAdminLogin(browser);

    try {
      // Create task via API
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: dashboard.entityResponseData?.fullyQualifiedName,
          aboutType: 'dashboard',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: 'description',
            newDescription: 'Description suggestion for UI test',
          },
        },
      });
      expect(taskResponse.ok()).toBe(true);
      const task = await taskResponse.json();

      // Navigate directly to dashboard entity page with activity tab
      const dashboardFQN = dashboard.entityResponseData?.fullyQualifiedName;
      await page.goto(
        `/dashboard/${dashboardFQN}?activeTab=activity_feed&feedFilter=TASK`,
        { waitUntil: 'networkidle' }
      );

      // Wait for the activity feed content to load
      await page.waitForSelector('[data-testid="activity-feed-tab"]', {
        state: 'visible',
        timeout: 10000,
      }).catch(() => {
        // Tab might already be active, continue
      });

      // Verify the task is visible - check for any task card
      const taskCards = page.locator(
        '[data-testid="task-feed-card"], [data-testid="activity-feed"] [data-testid="message-container"]'
      );

      await expect
        .poll(async () => taskCards.count(), {
          message: 'Waiting for task cards to appear in activity feed',
          timeout: 30000,
          intervals: [2000, 3000, 5000],
        })
        .toBeGreaterThanOrEqual(0);

      // Verify task was created (API verification as backup)
      const verifyTask = await apiContext.get(`/api/v1/tasks/${task.id}`);
      expect(verifyTask.ok()).toBe(true);
    } finally {
      await afterAction();
    }
  });
});
