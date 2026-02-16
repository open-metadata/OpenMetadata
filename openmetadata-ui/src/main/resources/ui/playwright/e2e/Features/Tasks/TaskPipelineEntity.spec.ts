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
import { PipelineClass } from '../../../support/entity/PipelineClass';
import { Domain } from '../../../support/domain/Domain';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';

/**
 * Task Tests for Pipeline Entities
 *
 * Tests task workflows for Pipeline entities including:
 * - Entity-level description tasks
 * - Pipeline task description tasks (tasks::taskName::description)
 * - Ownership update tasks for pipelines
 * - Tier update tasks for pipelines
 * - Domain update tasks for pipelines
 */

test.describe('Task Creation and Resolution - Pipeline Entity', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const pipeline = new PipelineClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await domain.create(apiContext);

      await pipeline.create(apiContext);

      // Set owner via patch
      await apiContext.patch(
        `/api/v1/pipelines/${pipeline.entityResponseData?.id}`,
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
      await pipeline.delete(apiContext);
      await domain.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve entity-level description task for Pipeline', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const newDescription = 'Updated Pipeline description from task';

    try {
      // Create DescriptionUpdate task for entity level
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: pipeline.entityResponseData?.fullyQualifiedName,
          aboutType: 'pipeline',
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
      const pipelineResponse = await apiContext.get(
        `/api/v1/pipelines/${pipeline.entityResponseData?.id}`
      );
      const updatedPipeline = await pipelineResponse.json();

      expect(updatedPipeline.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('should create and approve pipeline task description update', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Get pipeline to find task name
      const pipelineResponse = await apiContext.get(
        `/api/v1/pipelines/${pipeline.entityResponseData?.id}?fields=tasks`
      );
      const pipelineData = await pipelineResponse.json();

      const pipelineTasks = pipelineData.tasks;
      if (!pipelineTasks || pipelineTasks.length === 0) {
        console.log('No pipeline tasks, skipping test');
        return;
      }

      const pipelineTaskName = pipelineTasks[0].name;
      const newTaskDescription = 'Updated pipeline task description from task';

      // Create DescriptionUpdate task for pipeline task
      // Format: tasks::taskName::description
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: pipeline.entityResponseData?.fullyQualifiedName,
          aboutType: 'pipeline',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            fieldPath: `tasks::${pipelineTaskName}::description`,
            newDescription: newTaskDescription,
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
            newValue: newTaskDescription,
          },
        }
      );
      expect(resolveResponse.ok()).toBe(true);

      // Verify pipeline task description was updated
      const updatedPipelineResponse = await apiContext.get(
        `/api/v1/pipelines/${pipeline.entityResponseData?.id}?fields=tasks`
      );
      const updatedPipeline = await updatedPipelineResponse.json();

      const updatedTask = updatedPipeline.tasks?.find(
        (t: { name: string }) => t.name === pipelineTaskName
      );
      expect(updatedTask?.description).toBe(newTaskDescription);
    } finally {
      await afterAction();
    }
  });

  test('should create OwnershipUpdate task for Pipeline', async ({
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
          about: pipeline.entityResponseData?.fullyQualifiedName,
          aboutType: 'pipeline',
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
      const pipelineResponse = await apiContext.get(
        `/api/v1/pipelines/${pipeline.entityResponseData?.id}?fields=owners`
      );
      const updatedPipeline = await pipelineResponse.json();

      expect(updatedPipeline.owners).toBeDefined();
      expect(updatedPipeline.owners[0].id).toBe(newOwner.responseData.id);

      // Cleanup new owner
      await newOwner.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should create TierUpdate task for Pipeline', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create TierUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: pipeline.entityResponseData?.fullyQualifiedName,
          aboutType: 'pipeline',
          type: 'TierUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            newTier: {
              tagFQN: 'Tier.Tier3',
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
      const pipelineResponse = await apiContext.get(
        `/api/v1/pipelines/${pipeline.entityResponseData?.id}?fields=tags`
      );
      const updatedPipeline = await pipelineResponse.json();

      const hasTier = updatedPipeline.tags?.some(
        (tag: { tagFQN: string }) => tag.tagFQN === 'Tier.Tier3'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('should create DomainUpdate task for Pipeline', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create DomainUpdate task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: pipeline.entityResponseData?.fullyQualifiedName,
          aboutType: 'pipeline',
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
      const pipelineResponse = await apiContext.get(
        `/api/v1/pipelines/${pipeline.entityResponseData?.id}?fields=domains`
      );
      const updatedPipeline = await pipelineResponse.json();

      expect(updatedPipeline.domains?.length).toBeGreaterThan(0);
      expect(updatedPipeline.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});
