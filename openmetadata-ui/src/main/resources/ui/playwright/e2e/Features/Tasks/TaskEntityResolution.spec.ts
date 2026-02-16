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
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';

/**
 * Task Entity Resolution Tests
 *
 * Tests resolution of different task types that apply changes to entities:
 * - OwnershipUpdate: Changes entity owners when approved
 * - TierUpdate: Applies tier tag when approved
 * - DomainUpdate: Changes entity domain when approved
 * - DescriptionUpdate: Updates entity/column descriptions when approved
 *
 * Each test verifies:
 * 1. Task creation with proper payload
 * 2. Task resolution (approve)
 * 3. Entity changes are applied correctly
 */

test.describe('Task Resolution - OwnershipUpdate', () => {
  const adminUser = new UserClass();
  const currentOwner = new UserClass();
  const newOwner = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await currentOwner.create(apiContext);
      await newOwner.create(apiContext);

      await table.create(apiContext);
      await apiContext.patch(`/api/v1/tables/${table.entityResponseData?.id}`, {
        data: [
          {
            op: 'add',
            path: '/owners',
            value: [{ id: currentOwner.responseData.id, type: 'user' }],
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
      await newOwner.delete(apiContext);
      await currentOwner.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve OwnershipUpdate task', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create OwnershipUpdate task via API
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'OwnershipUpdate',
          category: 'MetadataUpdate',
          assignees: [currentOwner.responseData.name],
          payload: {
            currentOwners: [
              { id: currentOwner.responseData.id, type: 'user' },
            ],
            newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
            reason: 'Transferring ownership to new team member',
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

      // Verify entity ownership changed
      const tableResponse = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}?fields=owners`
      );
      const updatedTable = await tableResponse.json();

      expect(updatedTable.owners).toBeDefined();
      expect(updatedTable.owners.length).toBeGreaterThan(0);
      expect(updatedTable.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  test('rejected OwnershipUpdate should NOT change ownership', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // First set owner back to currentOwner
      await apiContext.patch(
        `/api/v1/tables/${table.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'replace',
              path: '/owners',
              value: [{ id: currentOwner.responseData.id, type: 'user' }],
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      // Create OwnershipUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'OwnershipUpdate',
          category: 'MetadataUpdate',
          assignees: [currentOwner.responseData.name],
          payload: {
            currentOwners: [
              { id: currentOwner.responseData.id, type: 'user' },
            ],
            newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
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

      // Verify entity ownership NOT changed
      const tableResponse = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}?fields=owners`
      );
      const updatedTable = await tableResponse.json();

      expect(updatedTable.owners[0].id).toBe(currentOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - TierUpdate', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

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
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve TierUpdate task', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create TierUpdate task via API
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'TierUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            newTier: {
              tagFQN: 'Tier.Tier1',
              source: 'Classification',
              labelType: 'Manual',
              state: 'Confirmed',
            },
            reason: 'Critical business data',
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
      const tableResponse = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}?fields=tags`
      );
      const updatedTable = await tableResponse.json();

      const hasTier = updatedTable.tags?.some(
        (tag: { tagFQN: string }) => tag.tagFQN === 'Tier.Tier1'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('rejected TierUpdate should NOT apply tier', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create TierUpdate task for Tier2
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'TierUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            newTier: {
              tagFQN: 'Tier.Tier2',
              source: 'Classification',
              labelType: 'Manual',
              state: 'Confirmed',
            },
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

      // Verify Tier2 was NOT applied
      const tableResponse = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}?fields=tags`
      );
      const updatedTable = await tableResponse.json();

      const hasTier2 = updatedTable.tags?.some(
        (tag: { tagFQN: string }) => tag.tagFQN === 'Tier.Tier2'
      );
      expect(hasTier2).toBe(false);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - DomainUpdate', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const table = new TableClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

      await domain.create(apiContext);
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
      await domain.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve DomainUpdate task', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create DomainUpdate task via API
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DomainUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            newDomain: {
              id: domain.responseData.id,
              type: 'domain',
              fullyQualifiedName: domain.responseData.fullyQualifiedName,
            },
            reason: 'Moving to correct data domain',
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
      const tableResponse = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}?fields=domains`
      );
      const updatedTable = await tableResponse.json();

      expect(updatedTable.domains).toBeDefined();
      expect(updatedTable.domains.length).toBeGreaterThan(0);
      expect(updatedTable.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - DescriptionUpdate at Entity Level', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

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
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should approve description update task and apply to entity', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const newDescription = 'Updated description from approved task';

    try {
      // Create DescriptionUpdate task via API
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
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

      // Resolve task with the suggested value
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
      const tableResponse = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}`
      );
      const updatedTable = await tableResponse.json();

      expect(updatedTable.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - Column Level Description', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

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
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should approve column description update task', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Get table to find column name
      const tableResponse = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}?fields=columns`
      );
      const tableData = await tableResponse.json();
      const columnName = tableData.columns?.[0]?.name;

      if (!columnName) {
        console.log('No columns in table, skipping test');
        return;
      }

      const newColumnDescription = 'Updated column description from task';

      // Create DescriptionUpdate task for column
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: `columns::${columnName}::description`,
            newDescription: newColumnDescription,
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
            newValue: newColumnDescription,
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);

      // Verify column description was updated
      const updatedTableResponse = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}?fields=columns`
      );
      const updatedTable = await updatedTableResponse.json();

      const updatedColumn = updatedTable.columns?.find(
        (col: { name: string }) => col.name === columnName
      );
      expect(updatedColumn?.description).toBe(newColumnDescription);
    } finally {
      await afterAction();
    }
  });
});
