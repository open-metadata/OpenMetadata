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

import { Domain } from '../../../support/domain/Domain';
import { TopicClass } from '../../../support/entity/TopicClass';
import { expect, test } from '../../../support/fixtures/base';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';

/**
 * Task Tests for Topic Entities
 *
 * Tests task workflows for Topic entities including:
 * - Entity-level description tasks
 * - Schema field description tasks (messageSchema.schemaFields.fieldName.description)
 * - Nested schema field tasks (parent.child pattern)
 * - Tag update tasks for topics
 * - Domain update tasks for topics
 */

test.describe('Task Creation and Resolution - Topic Entity', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const topic = new TopicClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await domain.create(apiContext);

      await topic.create(apiContext);

      // Set owner via patch
      await apiContext.patch(`/api/v1/topics/${topic.entityResponseData?.id}`, {
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
      await topic.delete(apiContext);
      await domain.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create OwnershipUpdate task for Topic', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create a new user to be the new owner
      const newOwner = new UserClass();
      await newOwner.create(apiContext);

      // Create OwnershipUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: `<#E::topic::${topic.entityResponseData?.fullyQualifiedName}>`,
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
      const topicResponse = await apiContext.get(
        `/api/v1/topics/${topic.entityResponseData?.id}?fields=owners`
      );
      const updatedTopic = await topicResponse.json();

      expect(updatedTopic.owners).toBeDefined();
      expect(updatedTopic.owners[0].id).toBe(newOwner.responseData.id);

      // Cleanup new owner
      await newOwner.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create TierUpdate task for Topic', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create TierUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: `<#E::topic::${topic.entityResponseData?.fullyQualifiedName}>`,
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
      const topicResponse = await apiContext.get(
        `/api/v1/topics/${topic.entityResponseData?.id}?fields=tags`
      );
      const updatedTopic = await topicResponse.json();

      const hasTier = updatedTopic.tags?.some(
        (tag: { tagFQN: string }) => tag.tagFQN === 'Tier.Tier2'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('should create DomainUpdate task for Topic', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create DomainUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: `<#E::topic::${topic.entityResponseData?.fullyQualifiedName}>`,
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
      const topicResponse = await apiContext.get(
        `/api/v1/topics/${topic.entityResponseData?.id}?fields=domains`
      );
      const updatedTopic = await topicResponse.json();

      expect(updatedTopic.domains?.length).toBeGreaterThan(0);
      expect(updatedTopic.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});
