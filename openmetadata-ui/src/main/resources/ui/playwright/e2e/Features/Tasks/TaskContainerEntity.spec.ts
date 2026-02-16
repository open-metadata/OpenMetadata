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
import { ContainerClass } from '../../../support/entity/ContainerClass';
import { Domain } from '../../../support/domain/Domain';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';

/**
 * Task Tests for Container Entities
 *
 * Tests task workflows for Container entities including:
 * - Entity-level description tasks
 * - DataModel column description tasks (dataModel::columnName::description)
 * - Ownership update tasks for containers
 * - Tier update tasks for containers
 * - Domain update tasks for containers
 */

test.describe('Task Creation and Resolution - Container Entity', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const container = new ContainerClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await domain.create(apiContext);

      await container.create(apiContext);

      // Set owner via patch
      await apiContext.patch(
        `/api/v1/containers/${container.entityResponseData?.id}`,
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
      await container.delete(apiContext);
      await domain.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve entity-level description task for Container', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const newDescription = 'Updated Container description from task';

    try {
      // Create DescriptionUpdate task for entity level
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: container.entityResponseData?.fullyQualifiedName,
          aboutType: 'container',
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
      const containerResponse = await apiContext.get(
        `/api/v1/containers/${container.entityResponseData?.id}`
      );
      const updatedContainer = await containerResponse.json();

      expect(updatedContainer.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve dataModel column description task for Container', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Get container to find dataModel column name
      const containerResponse = await apiContext.get(
        `/api/v1/containers/${container.entityResponseData?.id}?fields=dataModel`
      );
      const containerData = await containerResponse.json();

      const columns = containerData.dataModel?.columns;
      if (!columns || columns.length === 0) {
        console.log('No dataModel columns in container, skipping test');
        return;
      }

      const columnName = columns[0].name;
      const newColumnDescription =
        'Updated dataModel column description from task';

      // Create DescriptionUpdate task for dataModel column
      // Format: dataModel::columnName::description
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: container.entityResponseData?.fullyQualifiedName,
          aboutType: 'container',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: `dataModel::${columnName}::description`,
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

      // Verify dataModel column description was updated
      const updatedContainerResponse = await apiContext.get(
        `/api/v1/containers/${container.entityResponseData?.id}?fields=dataModel`
      );
      const updatedContainer = await updatedContainerResponse.json();

      const updatedColumn = updatedContainer.dataModel?.columns?.find(
        (col: { name: string }) => col.name === columnName
      );
      expect(updatedColumn?.description).toBe(newColumnDescription);
    } finally {
      await afterAction();
    }
  });

  test('should create OwnershipUpdate task for Container', async ({
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
          about: container.entityResponseData?.fullyQualifiedName,
          aboutType: 'container',
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
      const containerResponse = await apiContext.get(
        `/api/v1/containers/${container.entityResponseData?.id}?fields=owners`
      );
      const updatedContainer = await containerResponse.json();

      expect(updatedContainer.owners).toBeDefined();
      expect(updatedContainer.owners[0].id).toBe(newOwner.responseData.id);

      // Cleanup new owner
      await newOwner.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create TierUpdate task for Container', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create TierUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: container.entityResponseData?.fullyQualifiedName,
          aboutType: 'container',
          type: 'TierUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            newTier: {
              tagFQN: 'Tier.Tier4',
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
      const containerResponse = await apiContext.get(
        `/api/v1/containers/${container.entityResponseData?.id}?fields=tags`
      );
      const updatedContainer = await containerResponse.json();

      const hasTier = updatedContainer.tags?.some(
        (tag: { tagFQN: string }) => tag.tagFQN === 'Tier.Tier4'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('should create DomainUpdate task for Container', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create DomainUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: container.entityResponseData?.fullyQualifiedName,
          aboutType: 'container',
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
      const containerResponse = await apiContext.get(
        `/api/v1/containers/${container.entityResponseData?.id}?fields=domains`
      );
      const updatedContainer = await containerResponse.json();

      expect(updatedContainer.domains?.length).toBeGreaterThan(0);
      expect(updatedContainer.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});
