/*
 *  Copyright 2026 Collate.
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

import type { APIRequestContext } from '@playwright/test';
import { expect, test, TestNamespace } from '../../fixtures/testNamespace';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { ApiServiceClass } from '../../support/entity/service/ApiServiceClass';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { MessagingServiceClass } from '../../support/entity/service/MessagingServiceClass';
import { MlmodelServiceClass } from '../../support/entity/service/MlmodelServiceClass';
import { PipelineServiceClass } from '../../support/entity/service/PipelineServiceClass';
import { SearchIndexServiceClass } from '../../support/entity/service/SearchIndexServiceClass';
import { StorageServiceClass } from '../../support/entity/service/StorageServiceClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';

type EntityIdentity = {
  fullyQualifiedName?: string;
  id?: string;
};

type EntityInstance = {
  create: (apiContext: APIRequestContext) => Promise<unknown>;
  delete: (apiContext: APIRequestContext) => Promise<unknown>;
  entityResponseData?: EntityIdentity;
  responseData?: EntityIdentity;
};

type EntityReference = {
  id: string;
  type: 'user';
};

type PropertyValues = {
  initial: unknown;
  updated: unknown;
};

type PropertyVariant = {
  config?: unknown;
  label: string;
  typeName: string;
  values:
    | PropertyValues
    | ((references: {
        initial: EntityReference;
        updated: EntityReference;
      }) => PropertyValues);
};

type EntityContract = {
  apiPath: string;
  createInstance: (namespace: TestNamespace) => EntityInstance;
  deleteRelated?: (
    apiContext: APIRequestContext,
    instance: EntityInstance
  ) => Promise<void>;
  typeName: string;
};

// Every fixture below pins its own service name via `namespace.name('…-service')`
// so custom-property contract assertions can locate the exact service they
// created. Shared mode would drop those pinned names — opt out uniformly.
const ENTITY_CONTRACTS: EntityContract[] = [
  {
    apiPath: 'containers',
    createInstance: (namespace) =>
      new ContainerClass({
        service: new StorageServiceClass(namespace.name('storage-service')),
      }),
    typeName: 'container',
  },
  {
    apiPath: 'dashboards',
    createInstance: (namespace) =>
      new DashboardClass({
        service: new DashboardServiceClass(namespace.name('dashboard-service')),
      }),
    typeName: 'dashboard',
  },
  {
    apiPath: 'topics',
    createInstance: (namespace) =>
      new TopicClass({
        service: new MessagingServiceClass(namespace.name('messaging-service')),
      }),
    typeName: 'topic',
  },
  {
    apiPath: 'pipelines',
    createInstance: (namespace) =>
      new PipelineClass({
        service: new PipelineServiceClass(namespace.name('pipeline-service')),
      }),
    typeName: 'pipeline',
  },
  {
    apiPath: 'databases',
    createInstance: () => new DatabaseClass(),
    typeName: 'database',
  },
  {
    apiPath: 'databaseSchemas',
    createInstance: () => new DatabaseSchemaClass(),
    typeName: 'databaseSchema',
  },
  {
    apiPath: 'glossaryTerms',
    createInstance: (namespace) =>
      new GlossaryTerm(undefined, undefined, namespace.name('glossary-term')),
    deleteRelated: async (apiContext, instance) => {
      await (instance as GlossaryTerm).glossary.delete(apiContext);
    },
    typeName: 'glossaryTerm',
  },
  {
    apiPath: 'mlmodels',
    createInstance: (namespace) =>
      new MlModelClass({
        service: new MlmodelServiceClass(namespace.name('mlmodel-service')),
      }),
    typeName: 'mlmodel',
  },
  {
    apiPath: 'searchIndexes',
    createInstance: (namespace) =>
      new SearchIndexClass({
        service: new SearchIndexServiceClass(namespace.name('search-service')),
      }),
    typeName: 'searchIndex',
  },
  {
    apiPath: 'storedProcedures',
    createInstance: (namespace) =>
      new StoredProcedureClass({
        service: new DatabaseServiceClass(
          namespace.name('stored-procedure-service')
        ),
      }),
    typeName: 'storedProcedure',
  },
  {
    apiPath: 'dashboard/datamodels',
    createInstance: (namespace) =>
      new DashboardDataModelClass({
        service: new DashboardServiceClass(
          namespace.name('data-model-service')
        ),
      }),
    typeName: 'dashboardDataModel',
  },
  {
    apiPath: 'metrics',
    createInstance: () => new MetricClass(),
    typeName: 'metric',
  },
  {
    apiPath: 'apiCollections',
    createInstance: (namespace) =>
      new ApiCollectionClass({
        name: namespace.name('api-collection'),
        service: new ApiServiceClass(namespace.name('api-collection')),
      }),
    typeName: 'apiCollection',
  },
  {
    apiPath: 'apiEndpoints',
    createInstance: (namespace) =>
      new ApiEndpointClass({
        name: namespace.name('api-endpoint'),
        service: new ApiServiceClass(namespace.name('api-endpoint-service')),
      }),
    typeName: 'apiEndpoint',
  },
  {
    apiPath: 'dataProducts',
    createInstance: (namespace) =>
      new DataProduct(undefined, namespace.name('data-product')),
    deleteRelated: async (apiContext, instance) => {
      for (const domain of (instance as DataProduct).getDomains()) {
        await domain.delete(apiContext);
      }
    },
    typeName: 'dataProduct',
  },
  {
    apiPath: 'domains',
    createInstance: (namespace) => {
      const name = namespace.name('domain');

      return new Domain({
        description: 'Custom property API contract domain',
        displayName: name,
        domainType: 'Aggregate',
        fullyQualifiedName: `"${name}"`,
        name,
      });
    },
    typeName: 'domain',
  },
];

const REMOVED_PROPERTY_VARIANTS: PropertyVariant[] = [
  {
    label: 'integer',
    typeName: 'integer',
    values: { initial: 42, updated: 84 },
  },
  {
    label: 'markdown',
    typeName: 'markdown',
    values: {
      initial: '**Initial contract value**',
      updated: '_Updated contract value_',
    },
  },
  {
    label: 'duration',
    typeName: 'duration',
    values: { initial: 'PT1H', updated: 'PT2H' },
  },
  {
    label: 'email',
    typeName: 'email',
    values: {
      initial: 'initial@example.com',
      updated: 'updated@example.com',
    },
  },
  {
    label: 'number',
    typeName: 'number',
    values: { initial: 12.5, updated: 24.75 },
  },
  {
    label: 'sql-query',
    typeName: 'sqlQuery',
    values: {
      initial: 'SELECT 1',
      updated: 'SELECT id FROM contract_values',
    },
  },
  {
    label: 'time-interval',
    typeName: 'timeInterval',
    values: {
      initial: { end: 1710831125924, start: 1710831125922 },
      updated: { end: 1710831126924, start: 1710831126922 },
    },
  },
  {
    label: 'timestamp',
    typeName: 'timestamp',
    values: { initial: 1710831125922, updated: 1710831126922 },
  },
  {
    label: 'hyperlink',
    typeName: 'hyperlink-cp',
    values: {
      initial: {
        displayText: 'Initial contract link',
        url: 'https://example.com/initial',
      },
      updated: {
        displayText: 'Updated contract link',
        url: 'https://open-metadata.org/updated',
      },
    },
  },
  {
    config: {
      multiSelect: true,
      values: ['enum1', 'enum2', 'enum3'],
    },
    label: 'enum',
    typeName: 'enum',
    values: { initial: ['enum1'], updated: ['enum2', 'enum3'] },
  },
  {
    config: { columns: ['pw-column1', 'pw-column2'] },
    label: 'table',
    typeName: 'table-cp',
    values: {
      initial: {
        columns: ['pw-column1', 'pw-column2'],
        rows: [{ 'pw-column1': 'initial-1', 'pw-column2': 'initial-2' }],
      },
      updated: {
        columns: ['pw-column1', 'pw-column2'],
        rows: [{ 'pw-column1': 'updated-1', 'pw-column2': 'updated-2' }],
      },
    },
  },
  {
    config: ['user'],
    label: 'entity-reference',
    typeName: 'entityReference',
    values: ({ initial, updated }) => ({ initial, updated }),
  },
  {
    config: ['user'],
    label: 'entity-reference-list',
    typeName: 'entityReferenceList',
    values: ({ initial, updated }) => ({
      initial: [initial],
      updated: [updated],
    }),
  },
  {
    config: 'yyyy-MM-dd',
    label: 'date',
    typeName: 'date-cp',
    values: { initial: '2024-07-09', updated: '2025-07-09' },
  },
  {
    config: 'HH:mm:ss',
    label: 'time',
    typeName: 'time-cp',
    values: { initial: '15:35:59', updated: '17:35:59' },
  },
  {
    config: 'yyyy-MM-dd HH:mm:ss',
    label: 'date-time',
    typeName: 'dateTime-cp',
    values: {
      initial: '2024-07-09 15:07:59',
      updated: '2025-07-09 15:07:59',
    },
  },
];

test('custom property value contract covers the exact removed browser matrix', () => {
  expect(ENTITY_CONTRACTS).toHaveLength(16);
  expect(REMOVED_PROPERTY_VARIANTS).toHaveLength(16);
  expect(
    new Set(REMOVED_PROPERTY_VARIANTS.map(({ typeName }) => typeName)).size
  ).toBe(16);
  expect((ENTITY_CONTRACTS.length + 1) * REMOVED_PROPERTY_VARIANTS.length).toBe(
    272
  );
});
