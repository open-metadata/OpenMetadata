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
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { DirectoryClass } from '../../../support/entity/DirectoryClass';
import { FileClass } from '../../../support/entity/FileClass';
import { MetricClass } from '../../../support/entity/MetricClass';
import { MlModelClass } from '../../../support/entity/MlModelClass';
import { PipelineClass } from '../../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../../support/entity/SearchIndexClass';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import { DataProduct } from '../../../support/domain/DataProduct';
import { Domain } from '../../../support/domain/Domain';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';

/**
 * Comprehensive Task Tests for All Entity Types
 *
 * Tests task workflows across all major entity types:
 * - Table, Topic, Dashboard, Pipeline, Container
 * - MLModel, SearchIndex, Metric
 * - Directory, File, DataProduct
 * - Glossary, GlossaryTerm
 *
 * Each entity type tests:
 * - DescriptionUpdate (entity level)
 * - OwnershipUpdate
 * - TierUpdate
 * - DomainUpdate
 * - TagUpdate (where applicable)
 */

// Helper function to create task and verify resolution
async function createAndResolveTask(
  apiContext: ReturnType<typeof performAdminLogin> extends Promise<infer T>
    ? T extends { apiContext: infer A }
      ? A
      : never
    : never,
  entityType: string,
  entityId: string,
  entityFqn: string,
  taskType: string,
  assigneeFqn: string,
  payload: Record<string, unknown>,
  fieldPath?: string
) {
  // Include fieldPath in payload if provided
  const taskPayload = { ...payload };
  if (fieldPath) {
    taskPayload.fieldPath = fieldPath;
  }

  const taskData: Record<string, unknown> = {
    about: entityFqn,
    aboutType: entityType,
    type: taskType,
    category: 'MetadataUpdate',
    assignees: [assigneeFqn],
    payload: taskPayload,
  };

  const taskResponse = await apiContext.post('/api/v1/tasks', {
    data: taskData,
  });
  const task = await taskResponse.json();
  expect(taskResponse.ok()).toBe(true);

  // Resolve task
  const resolveData: Record<string, unknown> = {
    resolutionType: 'Approved',
  };

  // For description updates, pass the new value
  if (taskType === 'DescriptionUpdate' && (payload.newDescription || payload.suggestedValue)) {
    resolveData.newValue = payload.newDescription || payload.suggestedValue;
  }

  const resolveResponse = await apiContext.post(
    `/api/v1/tasks/${task.id}/resolve`,
    { data: resolveData }
  );
  expect(resolveResponse.ok()).toBe(true);

  return task;
}

test.describe('Task Resolution - Table Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const table = new TableClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
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
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('DescriptionUpdate task for Table', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated Table description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'table',
        table.entityResponseData?.id,
        table.entityResponseData?.fullyQualifiedName,
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('OwnershipUpdate task for Table', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'table',
        table.entityResponseData?.id,
        table.entityResponseData?.fullyQualifiedName,
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  test('TierUpdate task for Table', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'table',
        table.entityResponseData?.id,
        table.entityResponseData?.fullyQualifiedName,
        'TierUpdate',
        ownerUser.responseData.name,
        {
          newTier: {
            tagFQN: 'Tier.Tier1',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}?fields=tags`
      );
      const updated = await response.json();
      const hasTier = updated.tags?.some(
        (t: { tagFQN: string }) => t.tagFQN === 'Tier.Tier1'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('DomainUpdate task for Table', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'table',
        table.entityResponseData?.id,
        table.entityResponseData?.fullyQualifiedName,
        'DomainUpdate',
        ownerUser.responseData.name,
        {
          newDomain: {
            id: domain.responseData.id,
            type: 'domain',
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}?fields=domains`
      );
      const updated = await response.json();
      expect(updated.domains?.length).toBeGreaterThan(0);
      expect(updated.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - Topic Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const topic = new TopicClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
      await domain.create(apiContext);

      await topic.create(apiContext);
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
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('DescriptionUpdate task for Topic', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated Topic description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'topic',
        topic.entityResponseData?.id,
        topic.entityResponseData?.fullyQualifiedName,
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/topics/${topic.entityResponseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('OwnershipUpdate task for Topic', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'topic',
        topic.entityResponseData?.id,
        topic.entityResponseData?.fullyQualifiedName,
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/topics/${topic.entityResponseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  test('TierUpdate task for Topic', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'topic',
        topic.entityResponseData?.id,
        topic.entityResponseData?.fullyQualifiedName,
        'TierUpdate',
        ownerUser.responseData.name,
        {
          newTier: {
            tagFQN: 'Tier.Tier2',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/topics/${topic.entityResponseData?.id}?fields=tags`
      );
      const updated = await response.json();
      const hasTier = updated.tags?.some(
        (t: { tagFQN: string }) => t.tagFQN === 'Tier.Tier2'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('DomainUpdate task for Topic', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'topic',
        topic.entityResponseData?.id,
        topic.entityResponseData?.fullyQualifiedName,
        'DomainUpdate',
        ownerUser.responseData.name,
        {
          newDomain: {
            id: domain.responseData.id,
            type: 'domain',
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/topics/${topic.entityResponseData?.id}?fields=domains`
      );
      const updated = await response.json();
      expect(updated.domains?.length).toBeGreaterThan(0);
      expect(updated.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - Dashboard Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const dashboard = new DashboardClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
      await domain.create(apiContext);

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
      await domain.delete(apiContext);
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('DescriptionUpdate task for Dashboard', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated Dashboard description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'dashboard',
        dashboard.entityResponseData?.id,
        dashboard.entityResponseData?.fullyQualifiedName,
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/dashboards/${dashboard.entityResponseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('OwnershipUpdate task for Dashboard', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'dashboard',
        dashboard.entityResponseData?.id,
        dashboard.entityResponseData?.fullyQualifiedName,
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/dashboards/${dashboard.entityResponseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  test('TierUpdate task for Dashboard', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'dashboard',
        dashboard.entityResponseData?.id,
        dashboard.entityResponseData?.fullyQualifiedName,
        'TierUpdate',
        ownerUser.responseData.name,
        {
          newTier: {
            tagFQN: 'Tier.Tier3',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/dashboards/${dashboard.entityResponseData?.id}?fields=tags`
      );
      const updated = await response.json();
      const hasTier = updated.tags?.some(
        (t: { tagFQN: string }) => t.tagFQN === 'Tier.Tier3'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('DomainUpdate task for Dashboard', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'dashboard',
        dashboard.entityResponseData?.id,
        dashboard.entityResponseData?.fullyQualifiedName,
        'DomainUpdate',
        ownerUser.responseData.name,
        {
          newDomain: {
            id: domain.responseData.id,
            type: 'domain',
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/dashboards/${dashboard.entityResponseData?.id}?fields=domains`
      );
      const updated = await response.json();
      expect(updated.domains?.length).toBeGreaterThan(0);
      expect(updated.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - Pipeline Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const pipeline = new PipelineClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
      await domain.create(apiContext);

      await pipeline.create(apiContext);
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
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('DescriptionUpdate task for Pipeline', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated Pipeline description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'pipeline',
        pipeline.entityResponseData?.id,
        pipeline.entityResponseData?.fullyQualifiedName,
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/pipelines/${pipeline.entityResponseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('OwnershipUpdate task for Pipeline', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'pipeline',
        pipeline.entityResponseData?.id,
        pipeline.entityResponseData?.fullyQualifiedName,
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/pipelines/${pipeline.entityResponseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  test('TierUpdate task for Pipeline', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'pipeline',
        pipeline.entityResponseData?.id,
        pipeline.entityResponseData?.fullyQualifiedName,
        'TierUpdate',
        ownerUser.responseData.name,
        {
          newTier: {
            tagFQN: 'Tier.Tier4',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/pipelines/${pipeline.entityResponseData?.id}?fields=tags`
      );
      const updated = await response.json();
      const hasTier = updated.tags?.some(
        (t: { tagFQN: string }) => t.tagFQN === 'Tier.Tier4'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('DomainUpdate task for Pipeline', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'pipeline',
        pipeline.entityResponseData?.id,
        pipeline.entityResponseData?.fullyQualifiedName,
        'DomainUpdate',
        ownerUser.responseData.name,
        {
          newDomain: {
            id: domain.responseData.id,
            type: 'domain',
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/pipelines/${pipeline.entityResponseData?.id}?fields=domains`
      );
      const updated = await response.json();
      expect(updated.domains?.length).toBeGreaterThan(0);
      expect(updated.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - Container Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const container = new ContainerClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
      await domain.create(apiContext);

      await container.create(apiContext);
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
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('DescriptionUpdate task for Container', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated Container description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'container',
        container.entityResponseData?.id,
        container.entityResponseData?.fullyQualifiedName,
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/containers/${container.entityResponseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('OwnershipUpdate task for Container', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'container',
        container.entityResponseData?.id,
        container.entityResponseData?.fullyQualifiedName,
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/containers/${container.entityResponseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  test('TierUpdate task for Container', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'container',
        container.entityResponseData?.id,
        container.entityResponseData?.fullyQualifiedName,
        'TierUpdate',
        ownerUser.responseData.name,
        {
          newTier: {
            tagFQN: 'Tier.Tier5',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/containers/${container.entityResponseData?.id}?fields=tags`
      );
      const updated = await response.json();
      const hasTier = updated.tags?.some(
        (t: { tagFQN: string }) => t.tagFQN === 'Tier.Tier5'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('DomainUpdate task for Container', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'container',
        container.entityResponseData?.id,
        container.entityResponseData?.fullyQualifiedName,
        'DomainUpdate',
        ownerUser.responseData.name,
        {
          newDomain: {
            id: domain.responseData.id,
            type: 'domain',
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/containers/${container.entityResponseData?.id}?fields=domains`
      );
      const updated = await response.json();
      expect(updated.domains?.length).toBeGreaterThan(0);
      expect(updated.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - MLModel Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const mlModel = new MlModelClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
      await domain.create(apiContext);

      await mlModel.create(apiContext);
      await apiContext.patch(
        `/api/v1/mlmodels/${mlModel.entityResponseData?.id}`,
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
      await mlModel.delete(apiContext);
      await domain.delete(apiContext);
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('DescriptionUpdate task for MLModel', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated MLModel description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'mlmodel',
        mlModel.entityResponseData?.id,
        mlModel.entityResponseData?.fullyQualifiedName,
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/mlmodels/${mlModel.entityResponseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('OwnershipUpdate task for MLModel', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'mlmodel',
        mlModel.entityResponseData?.id,
        mlModel.entityResponseData?.fullyQualifiedName,
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/mlmodels/${mlModel.entityResponseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  test('TierUpdate task for MLModel', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'mlmodel',
        mlModel.entityResponseData?.id,
        mlModel.entityResponseData?.fullyQualifiedName,
        'TierUpdate',
        ownerUser.responseData.name,
        {
          newTier: {
            tagFQN: 'Tier.Tier1',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/mlmodels/${mlModel.entityResponseData?.id}?fields=tags`
      );
      const updated = await response.json();
      const hasTier = updated.tags?.some(
        (t: { tagFQN: string }) => t.tagFQN === 'Tier.Tier1'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('DomainUpdate task for MLModel', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'mlmodel',
        mlModel.entityResponseData?.id,
        mlModel.entityResponseData?.fullyQualifiedName,
        'DomainUpdate',
        ownerUser.responseData.name,
        {
          newDomain: {
            id: domain.responseData.id,
            type: 'domain',
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/mlmodels/${mlModel.entityResponseData?.id}?fields=domains`
      );
      const updated = await response.json();
      expect(updated.domains?.length).toBeGreaterThan(0);
      expect(updated.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - SearchIndex Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const searchIndex = new SearchIndexClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
      await domain.create(apiContext);

      await searchIndex.create(apiContext);
      await apiContext.patch(
        `/api/v1/searchIndexes/${searchIndex.entityResponseData?.id}`,
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
      await searchIndex.delete(apiContext);
      await domain.delete(apiContext);
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('DescriptionUpdate task for SearchIndex', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated SearchIndex description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'searchIndex',
        searchIndex.entityResponseData?.id,
        searchIndex.entityResponseData?.fullyQualifiedName,
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/searchIndexes/${searchIndex.entityResponseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('OwnershipUpdate task for SearchIndex', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'searchIndex',
        searchIndex.entityResponseData?.id,
        searchIndex.entityResponseData?.fullyQualifiedName,
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/searchIndexes/${searchIndex.entityResponseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  test('TierUpdate task for SearchIndex', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'searchIndex',
        searchIndex.entityResponseData?.id,
        searchIndex.entityResponseData?.fullyQualifiedName,
        'TierUpdate',
        ownerUser.responseData.name,
        {
          newTier: {
            tagFQN: 'Tier.Tier2',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/searchIndexes/${searchIndex.entityResponseData?.id}?fields=tags`
      );
      const updated = await response.json();
      const hasTier = updated.tags?.some(
        (t: { tagFQN: string }) => t.tagFQN === 'Tier.Tier2'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('DomainUpdate task for SearchIndex', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'searchIndex',
        searchIndex.entityResponseData?.id,
        searchIndex.entityResponseData?.fullyQualifiedName,
        'DomainUpdate',
        ownerUser.responseData.name,
        {
          newDomain: {
            id: domain.responseData.id,
            type: 'domain',
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/searchIndexes/${searchIndex.entityResponseData?.id}?fields=domains`
      );
      const updated = await response.json();
      expect(updated.domains?.length).toBeGreaterThan(0);
      expect(updated.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - Glossary Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const glossary = new Glossary();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
      await domain.create(apiContext);

      await glossary.create(apiContext);
      await apiContext.patch(
        `/api/v1/glossaries/${glossary.responseData?.id}`,
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
      await glossary.delete(apiContext);
      await domain.delete(apiContext);
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('DescriptionUpdate task for Glossary', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated Glossary description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'glossary',
        glossary.responseData?.id,
        glossary.responseData?.fullyQualifiedName,
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/glossaries/${glossary.responseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('OwnershipUpdate task for Glossary', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'glossary',
        glossary.responseData?.id,
        glossary.responseData?.fullyQualifiedName,
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/glossaries/${glossary.responseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  test('DomainUpdate task for Glossary', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'glossary',
        glossary.responseData?.id,
        glossary.responseData?.fullyQualifiedName,
        'DomainUpdate',
        ownerUser.responseData.name,
        {
          newDomain: {
            id: domain.responseData.id,
            type: 'domain',
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/glossaries/${glossary.responseData?.id}?fields=domains`
      );
      const updated = await response.json();
      expect(updated.domains?.length).toBeGreaterThan(0);
      expect(updated.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - GlossaryTerm Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
      await domain.create(apiContext);

      await glossary.create(apiContext);
      glossaryTerm.data.glossary = glossary.responseData?.fullyQualifiedName;
      await glossaryTerm.create(apiContext);

      await apiContext.patch(
        `/api/v1/glossaryTerms/${glossaryTerm.responseData?.id}`,
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
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await domain.delete(apiContext);
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('DescriptionUpdate task for GlossaryTerm', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated GlossaryTerm description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'glossaryTerm',
        glossaryTerm.responseData?.id,
        glossaryTerm.responseData?.fullyQualifiedName,
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/glossaryTerms/${glossaryTerm.responseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('OwnershipUpdate task for GlossaryTerm', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'glossaryTerm',
        glossaryTerm.responseData?.id,
        glossaryTerm.responseData?.fullyQualifiedName,
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/glossaryTerms/${glossaryTerm.responseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  test('DomainUpdate task for GlossaryTerm', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'glossaryTerm',
        glossaryTerm.responseData?.id,
        glossaryTerm.responseData?.fullyQualifiedName,
        'DomainUpdate',
        ownerUser.responseData.name,
        {
          newDomain: {
            id: domain.responseData.id,
            type: 'domain',
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/glossaryTerms/${glossaryTerm.responseData?.id}?fields=domains`
      );
      const updated = await response.json();
      expect(updated.domains?.length).toBeGreaterThan(0);
      expect(updated.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - Metric Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const metric = new MetricClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
      await domain.create(apiContext);

      await metric.create(apiContext);
      await apiContext.patch(`/api/v1/metrics/${metric.entityResponseData?.id}`, {
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
      await metric.delete(apiContext);
      await domain.delete(apiContext);
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('DescriptionUpdate task for Metric', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated Metric description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'metric',
        metric.entityResponseData?.id,
        metric.entityResponseData?.fullyQualifiedName,
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/metrics/${metric.entityResponseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('OwnershipUpdate task for Metric', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'metric',
        metric.entityResponseData?.id,
        metric.entityResponseData?.fullyQualifiedName,
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/metrics/${metric.entityResponseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  test('TierUpdate task for Metric', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'metric',
        metric.entityResponseData?.id,
        metric.entityResponseData?.fullyQualifiedName,
        'TierUpdate',
        ownerUser.responseData.name,
        {
          newTier: {
            tagFQN: 'Tier.Tier3',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/metrics/${metric.entityResponseData?.id}?fields=tags`
      );
      const updated = await response.json();
      const hasTier = updated.tags?.some(
        (t: { tagFQN: string }) => t.tagFQN === 'Tier.Tier3'
      );
      expect(hasTier).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('DomainUpdate task for Metric', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'metric',
        metric.entityResponseData?.id,
        metric.entityResponseData?.fullyQualifiedName,
        'DomainUpdate',
        ownerUser.responseData.name,
        {
          newDomain: {
            id: domain.responseData.id,
            type: 'domain',
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/metrics/${metric.entityResponseData?.id}?fields=domains`
      );
      const updated = await response.json();
      expect(updated.domains?.length).toBeGreaterThan(0);
      expect(updated.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - File Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const file = new FileClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
      await domain.create(apiContext);

      await file.create(apiContext);
      await apiContext.patch(`/api/v1/files/${file.entityResponseData?.id}`, {
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
      await file.delete(apiContext);
      await domain.delete(apiContext);
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  // TODO: File entity task support needs investigation
  test.skip('DescriptionUpdate task for File', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated File description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'file',
        file.entityResponseData?.id,
        file.entityResponseData?.fullyQualifiedName,
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/files/${file.entityResponseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  // TODO: File entity task support needs investigation
  test.skip('OwnershipUpdate task for File', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'file',
        file.entityResponseData?.id,
        file.entityResponseData?.fullyQualifiedName,
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/files/${file.entityResponseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  // TODO: File entity task support needs investigation
  test.skip('DomainUpdate task for File', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'file',
        file.entityResponseData?.id,
        file.entityResponseData?.fullyQualifiedName,
        'DomainUpdate',
        ownerUser.responseData.name,
        {
          newDomain: {
            id: domain.responseData.id,
            type: 'domain',
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/files/${file.entityResponseData?.id}?fields=domains`
      );
      const updated = await response.json();
      expect(updated.domains?.length).toBeGreaterThan(0);
      expect(updated.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - Directory Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const directory = new DirectoryClass();
  const domain = new Domain();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
      await domain.create(apiContext);

      await directory.create(apiContext);
      await apiContext.patch(
        `/api/v1/directories/${directory.entityResponseData?.id}`,
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
      await directory.delete(apiContext);
      await domain.delete(apiContext);
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  // TODO: Directory entity task support needs investigation
  test.skip('DescriptionUpdate task for Directory', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated Directory description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'directory',
        directory.entityResponseData?.id,
        directory.entityResponseData?.fullyQualifiedName,
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/directories/${directory.entityResponseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  // TODO: Directory entity task support needs investigation
  test.skip('OwnershipUpdate task for Directory', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'directory',
        directory.entityResponseData?.id,
        directory.entityResponseData?.fullyQualifiedName,
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/directories/${directory.entityResponseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });

  // TODO: Directory entity task support needs investigation
  test.skip('DomainUpdate task for Directory', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'directory',
        directory.entityResponseData?.id,
        directory.entityResponseData?.fullyQualifiedName,
        'DomainUpdate',
        ownerUser.responseData.name,
        {
          newDomain: {
            id: domain.responseData.id,
            type: 'domain',
            fullyQualifiedName: domain.responseData.fullyQualifiedName,
          },
        }
      );

      const response = await apiContext.get(
        `/api/v1/directories/${directory.entityResponseData?.id}?fields=domains`
      );
      const updated = await response.json();
      expect(updated.domains?.length).toBeGreaterThan(0);
      expect(updated.domains[0].id).toBe(domain.responseData.id);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Task Resolution - DataProduct Entity (All Task Types)', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const newOwner = new UserClass();
  const domain = new Domain();
  let dataProduct: DataProduct;

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);
      await newOwner.create(apiContext);
      await domain.create(apiContext);

      dataProduct = new DataProduct([domain]);
      await dataProduct.create(apiContext);
      await apiContext.patch(
        `/api/v1/dataProducts/${dataProduct.responseData?.id}`,
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
      await dataProduct.delete(apiContext);
      await domain.delete(apiContext);
      await newOwner.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('DescriptionUpdate task for DataProduct', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const newDescription = 'Updated DataProduct description via task';

    try {
      await createAndResolveTask(
        apiContext,
        'dataProduct',
        dataProduct.responseData?.id ?? '',
        dataProduct.responseData?.fullyQualifiedName ?? '',
        'DescriptionUpdate',
        ownerUser.responseData.name,
        { newDescription: newDescription },
        'description'
      );

      const response = await apiContext.get(
        `/api/v1/dataProducts/${dataProduct.responseData?.id}`
      );
      const updated = await response.json();
      expect(updated.description).toBe(newDescription);
    } finally {
      await afterAction();
    }
  });

  test('OwnershipUpdate task for DataProduct', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await createAndResolveTask(
        apiContext,
        'dataProduct',
        dataProduct.responseData?.id ?? '',
        dataProduct.responseData?.fullyQualifiedName ?? '',
        'OwnershipUpdate',
        ownerUser.responseData.name,
        {
          currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
          newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
        }
      );

      const response = await apiContext.get(
        `/api/v1/dataProducts/${dataProduct.responseData?.id}?fields=owners`
      );
      const updated = await response.json();
      expect(updated.owners[0].id).toBe(newOwner.responseData.id);
    } finally {
      await afterAction();
    }
  });
});
