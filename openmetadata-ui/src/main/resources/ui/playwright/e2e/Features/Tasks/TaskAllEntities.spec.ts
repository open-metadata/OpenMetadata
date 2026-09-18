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

import { APIRequestContext } from '@playwright/test';
import { DataProduct } from '../../../support/domain/DataProduct';
import { Domain } from '../../../support/domain/Domain';
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
import { expect, test } from '../../../support/fixtures/base';
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
 * Each entity type tests (where supported):
 * - DescriptionUpdate (entity level)
 * - OwnershipUpdate
 * - TierUpdate
 * - DomainUpdate
 *
 * Coverage is driven by a single config list so every entity runs the same
 * generic suite instead of duplicating the same describe/test blocks.
 */

type TaskResponseData = { id: string; fullyQualifiedName: string };

interface EntityLike {
  create(apiContext: APIRequestContext): Promise<unknown>;
  delete(apiContext: APIRequestContext): Promise<unknown>;
}

interface TaskEntityConfig {
  name: string;
  entityType: string;
  endpoint: string;
  tierFQN?: string;
  supportsDomain?: boolean;
  build: (domain: Domain) => {
    entity: EntityLike;
    getData: () => TaskResponseData;
    cleanup?: (apiContext: APIRequestContext) => Promise<unknown>;
  };
}

function toTaskData(source: {
  id?: string;
  fullyQualifiedName?: string;
}): TaskResponseData {
  return {
    id: source.id ?? '',
    fullyQualifiedName: source.fullyQualifiedName ?? '',
  };
}

async function createAndResolveTask(
  apiContext: APIRequestContext,
  entityType: string,
  entityFqn: string,
  taskType: string,
  assigneeFqn: string,
  payload: Record<string, unknown>,
  fieldPath?: string
) {
  const taskPayload = { ...payload };
  if (fieldPath) {
    taskPayload.fieldPath = fieldPath;
  }

  const taskData: Record<string, unknown> = {
    about: `<#E::${entityType}::${entityFqn}>`,
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

  const resolveData: Record<string, unknown> = {
    resolutionType: 'Approved',
  };

  if (
    taskType === 'DescriptionUpdate' &&
    (payload.newDescription || payload.suggestedValue)
  ) {
    resolveData.newValue = payload.newDescription || payload.suggestedValue;
  }

  const resolveResponse = await apiContext.post(
    `/api/v1/tasks/${task.id}/resolve`,
    { data: resolveData }
  );
  expect(resolveResponse.ok()).toBe(true);

  return task;
}

const TASK_ENTITY_CONFIGS: TaskEntityConfig[] = [
  {
    name: 'Table',
    entityType: 'table',
    endpoint: 'tables',
    tierFQN: 'Tier.Tier1',
    build: (): { entity: EntityLike; getData: () => TaskResponseData } => {
      const table = new TableClass();

      return {
        entity: table,
        getData: () => toTaskData(table.entityResponseData),
      };
    },
  },
  {
    name: 'Topic',
    entityType: 'topic',
    endpoint: 'topics',
    tierFQN: 'Tier.Tier2',
    build: (): { entity: EntityLike; getData: () => TaskResponseData } => {
      const topic = new TopicClass();

      return {
        entity: topic,
        getData: () => toTaskData(topic.entityResponseData),
      };
    },
  },
  {
    name: 'Dashboard',
    entityType: 'dashboard',
    endpoint: 'dashboards',
    tierFQN: 'Tier.Tier3',
    build: (): { entity: EntityLike; getData: () => TaskResponseData } => {
      const dashboard = new DashboardClass();

      return {
        entity: dashboard,
        getData: () => toTaskData(dashboard.entityResponseData),
      };
    },
  },
  {
    name: 'Pipeline',
    entityType: 'pipeline',
    endpoint: 'pipelines',
    tierFQN: 'Tier.Tier4',
    build: (): { entity: EntityLike; getData: () => TaskResponseData } => {
      const pipeline = new PipelineClass();

      return {
        entity: pipeline,
        getData: () => toTaskData(pipeline.entityResponseData),
      };
    },
  },
  {
    name: 'Container',
    entityType: 'container',
    endpoint: 'containers',
    tierFQN: 'Tier.Tier5',
    build: (): { entity: EntityLike; getData: () => TaskResponseData } => {
      const container = new ContainerClass();

      return {
        entity: container,
        getData: () => toTaskData(container.entityResponseData),
      };
    },
  },
  {
    name: 'MLModel',
    entityType: 'mlmodel',
    endpoint: 'mlmodels',
    tierFQN: 'Tier.Tier1',
    build: (): { entity: EntityLike; getData: () => TaskResponseData } => {
      const mlModel = new MlModelClass();

      return {
        entity: mlModel,
        getData: () => toTaskData(mlModel.entityResponseData),
      };
    },
  },
  {
    name: 'SearchIndex',
    entityType: 'searchIndex',
    endpoint: 'searchIndexes',
    tierFQN: 'Tier.Tier2',
    build: (): { entity: EntityLike; getData: () => TaskResponseData } => {
      const searchIndex = new SearchIndexClass();

      return {
        entity: searchIndex,
        getData: () => toTaskData(searchIndex.entityResponseData),
      };
    },
  },
  {
    name: 'Metric',
    entityType: 'metric',
    endpoint: 'metrics',
    tierFQN: 'Tier.Tier3',
    build: (): { entity: EntityLike; getData: () => TaskResponseData } => {
      const metric = new MetricClass();

      return {
        entity: metric,
        getData: () => toTaskData(metric.entityResponseData),
      };
    },
  },
  {
    name: 'Glossary',
    entityType: 'glossary',
    endpoint: 'glossaries',
    build: (): { entity: EntityLike; getData: () => TaskResponseData } => {
      const glossary = new Glossary();

      return {
        entity: glossary,
        getData: () => toTaskData(glossary.responseData),
      };
    },
  },
  {
    name: 'GlossaryTerm',
    entityType: 'glossaryTerm',
    endpoint: 'glossaryTerms',
    build: (): {
      entity: EntityLike;
      getData: () => TaskResponseData;
      cleanup: (apiContext: APIRequestContext) => Promise<unknown>;
    } => {
      const glossary = new Glossary();
      const glossaryTerm = new GlossaryTerm(glossary);
      glossaryTerm.createGlossary = true;

      return {
        entity: glossaryTerm,
        getData: () => toTaskData(glossaryTerm.responseData),
        cleanup: (apiContext: APIRequestContext) => glossary.delete(apiContext),
      };
    },
  },
  {
    name: 'File',
    entityType: 'file',
    endpoint: 'drives/files',
    build: (): { entity: EntityLike; getData: () => TaskResponseData } => {
      const file = new FileClass();

      return {
        entity: file,
        getData: () => toTaskData(file.entityResponseData),
      };
    },
  },
  {
    name: 'Directory',
    entityType: 'directory',
    endpoint: 'drives/directories',
    build: (): { entity: EntityLike; getData: () => TaskResponseData } => {
      const directory = new DirectoryClass();

      return {
        entity: directory,
        getData: () => toTaskData(directory.entityResponseData),
      };
    },
  },
  {
    name: 'DataProduct',
    entityType: 'dataProduct',
    endpoint: 'dataProducts',
    supportsDomain: false,
    build: (
      domain: Domain
    ): { entity: EntityLike; getData: () => TaskResponseData } => {
      const dataProduct = new DataProduct([domain]);
      dataProduct.createDomain = false;

      return {
        entity: dataProduct,
        getData: () => ({
          id: dataProduct.responseData?.id ?? '',
          fullyQualifiedName:
            dataProduct.responseData?.fullyQualifiedName ?? '',
        }),
      };
    },
  },
];

function runTaskSuite(config: TaskEntityConfig) {
  test.describe(`Task Resolution - ${config.name} Entity (All Task Types)`, () => {
    test.describe.configure({ mode: 'default' });

    const adminUser = new UserClass();
    const ownerUser = new UserClass();
    const newOwner = new UserClass();
    const domain = new Domain();

    let entity: EntityLike | undefined;
    let getData: () => TaskResponseData;
    let cleanup:
      | ((apiContext: APIRequestContext) => Promise<unknown>)
      | undefined;

    test.beforeAll('Setup test data', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await adminUser.create(apiContext);
        await adminUser.setAdminRole(apiContext);
        await ownerUser.create(apiContext);
        await newOwner.create(apiContext);
        await domain.create(apiContext);

        const built = config.build(domain);
        entity = built.entity;
        getData = built.getData;
        cleanup = built.cleanup;

        await entity.create(apiContext);
        await apiContext.patch(`/api/v1/${config.endpoint}/${getData().id}`, {
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
        if (entity) {
          await entity.delete(apiContext);
        }
        if (cleanup) {
          await cleanup(apiContext);
        }
        await domain.delete(apiContext);
        await newOwner.delete(apiContext);
        await ownerUser.delete(apiContext);
        await adminUser.delete(apiContext);
      } finally {
        await afterAction();
      }
    });

    test(`DescriptionUpdate task for ${config.name}`, async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      const newDescription = `Updated ${config.name} description via task`;

      try {
        const data = getData();
        await createAndResolveTask(
          apiContext,
          config.entityType,
          data.fullyQualifiedName,
          'DescriptionUpdate',
          ownerUser.responseData.name,
          { newDescription: newDescription },
          'description'
        );

        const response = await apiContext.get(
          `/api/v1/${config.endpoint}/${data.id}`
        );
        const updated = await response.json();
        expect(updated.description).toBe(newDescription);
      } finally {
        await afterAction();
      }
    });

    test(`OwnershipUpdate task for ${config.name}`, async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const data = getData();
        await createAndResolveTask(
          apiContext,
          config.entityType,
          data.fullyQualifiedName,
          'OwnershipUpdate',
          ownerUser.responseData.name,
          {
            currentOwners: [{ id: ownerUser.responseData.id, type: 'user' }],
            newOwners: [{ id: newOwner.responseData.id, type: 'user' }],
          }
        );

        const response = await apiContext.get(
          `/api/v1/${config.endpoint}/${data.id}?fields=owners`
        );
        const updated = await response.json();
        expect(updated.owners[0].id).toBe(newOwner.responseData.id);
      } finally {
        await afterAction();
      }
    });

    if (config.tierFQN) {
      test(`TierUpdate task for ${config.name}`, async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        try {
          const data = getData();
          await createAndResolveTask(
            apiContext,
            config.entityType,
            data.fullyQualifiedName,
            'TierUpdate',
            ownerUser.responseData.name,
            {
              newTier: {
                tagFQN: config.tierFQN,
                source: 'Classification',
                labelType: 'Manual',
                state: 'Confirmed',
              },
            }
          );

          const response = await apiContext.get(
            `/api/v1/${config.endpoint}/${data.id}?fields=tags`
          );
          const updated = await response.json();
          const hasTier = updated.tags?.some(
            (t: { tagFQN: string }) => t.tagFQN === config.tierFQN
          );
          expect(hasTier).toBe(true);
        } finally {
          await afterAction();
        }
      });
    }

    if (config.supportsDomain !== false) {
      test(`DomainUpdate task for ${config.name}`, async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        try {
          const data = getData();
          await createAndResolveTask(
            apiContext,
            config.entityType,
            data.fullyQualifiedName,
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
            `/api/v1/${config.endpoint}/${data.id}?fields=domains`
          );
          const updated = await response.json();
          expect(updated.domains?.length).toBeGreaterThan(0);
          expect(updated.domains[0].id).toBe(domain.responseData.id);
        } finally {
          await afterAction();
        }
      });
    }
  });
}

TASK_ENTITY_CONFIGS.forEach(runTaskSuite);
