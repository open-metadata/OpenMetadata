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
import { TopicClass } from '../../../support/entity/TopicClass';
import { Domain } from '../../../support/domain/Domain';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';

/**
 * Task Tests for Topic Entities
 *
 * Tests task workflows for Topic entities including:
 * - Entity-level description tasks
 * - Schema field description tasks (messageSchema::fieldName::description)
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
      await apiContext.patch(
        `/api/v1/topics/${topic.entityResponseData?.id}`,
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
      await topic.delete(apiContext);
      await domain.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve entity-level description task for Topic', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const newDescription = 'Updated Topic description from task';

    try {
      // Create DescriptionUpdate task for entity level
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: topic.entityResponseData?.fullyQualifiedName,
          aboutType: 'topic',
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
      const topicResponse = await apiContext.get(
        `/api/v1/topics/${topic.entityResponseData?.id}`
      );
      const updatedTopic = await topicResponse.json();

      expect(updatedTopic.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve schema field description task for Topic', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Get topic to find schema field
      const topicResponse = await apiContext.get(
        `/api/v1/topics/${topic.entityResponseData?.id}?fields=messageSchema`
      );
      const topicData = await topicResponse.json();

      const schemaFields = topicData.messageSchema?.schemaFields;
      if (!schemaFields || schemaFields.length === 0) {
        console.log('No schema fields in topic, skipping test');
        return;
      }

      // Find a leaf field (not a parent with children)
      const findLeafField = (
        fields: Array<{ name: string; children?: unknown[] }>
      ): string | null => {
        for (const field of fields) {
          if (!field.children || field.children.length === 0) {
            return field.name;
          }
          // Check children
          if (field.children) {
            const childResult = findLeafField(
              field.children as Array<{ name: string; children?: unknown[] }>
            );
            if (childResult) {
              return `${field.name}.${childResult}`;
            }
          }
        }
        return null;
      };

      const fieldPath = findLeafField(schemaFields);
      if (!fieldPath) {
        console.log('No leaf schema fields found, skipping test');
        return;
      }

      const newFieldDescription = 'Updated schema field description from task';

      // Create DescriptionUpdate task for schema field
      // Format: messageSchema::fieldName::description
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: topic.entityResponseData?.fullyQualifiedName,
          aboutType: 'topic',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: `messageSchema::${fieldPath}::description`,
            newDescription: newFieldDescription,
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
            newValue: newFieldDescription,
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);

      // Verify schema field description was updated
      const updatedTopicResponse = await apiContext.get(
        `/api/v1/topics/${topic.entityResponseData?.id}?fields=messageSchema`
      );
      const updatedTopic = await updatedTopicResponse.json();

      // Find the field in the schema to verify
      const findFieldDescription = (
        fields: Array<{ name: string; description?: string; children?: unknown[] }>,
        path: string
      ): string | undefined => {
        const parts = path.split('.');
        for (const field of fields) {
          if (field.name === parts[0]) {
            if (parts.length === 1) {
              return field.description;
            }
            if (field.children) {
              return findFieldDescription(
                field.children as Array<{
                  name: string;
                  description?: string;
                  children?: unknown[];
                }>,
                parts.slice(1).join('.')
              );
            }
          }
        }
        return undefined;
      };

      const updatedDescription = findFieldDescription(
        updatedTopic.messageSchema?.schemaFields || [],
        fieldPath
      );
      expect(updatedDescription).toBe(newFieldDescription);
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
          about: topic.entityResponseData?.fullyQualifiedName,
          aboutType: 'topic',
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
          about: topic.entityResponseData?.fullyQualifiedName,
          aboutType: 'topic',
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
          about: topic.entityResponseData?.fullyQualifiedName,
          aboutType: 'topic',
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
