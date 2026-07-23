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

import type { APIRequestContext, APIResponse } from '@playwright/test';
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
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';

type PropertyType = {
  id: string;
  name: string;
};

type CustomProperty = {
  customPropertyConfig?: {
    config: unknown;
  };
  description: string;
  name: string;
  propertyType: PropertyType;
};

type EntityType = {
  customProperties?: CustomProperty[];
  id: string;
  name: string;
};

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

type ValueTarget = {
  getExtension: () => Promise<Record<string, unknown>>;
  removeValue: (propertyName: string) => Promise<void>;
  setValue: (propertyName: string, value: unknown) => Promise<void>;
};

const ENTITY_CONTRACTS: EntityContract[] = [
  {
    apiPath: 'containers',
    createInstance: (namespace) =>
      new ContainerClass(namespace.name('storage-service')),
    typeName: 'container',
  },
  {
    apiPath: 'dashboards',
    createInstance: (namespace) =>
      new DashboardClass(namespace.name('dashboard-service')),
    typeName: 'dashboard',
  },
  {
    apiPath: 'topics',
    createInstance: (namespace) =>
      new TopicClass(namespace.name('messaging-service')),
    typeName: 'topic',
  },
  {
    apiPath: 'pipelines',
    createInstance: (namespace) =>
      new PipelineClass(namespace.name('pipeline-service')),
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
      new MlModelClass(namespace.name('mlmodel-service')),
    typeName: 'mlmodel',
  },
  {
    apiPath: 'searchIndexes',
    createInstance: (namespace) =>
      new SearchIndexClass(namespace.name('search-service')),
    typeName: 'searchIndex',
  },
  {
    apiPath: 'storedProcedures',
    createInstance: (namespace) =>
      new StoredProcedureClass(namespace.name('stored-procedure-service')),
    typeName: 'storedProcedure',
  },
  {
    apiPath: 'dashboard/datamodels',
    createInstance: (namespace) =>
      new DashboardDataModelClass(namespace.name('data-model-service')),
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
      new ApiCollectionClass(namespace.name('api-collection')),
    typeName: 'apiCollection',
  },
  {
    apiPath: 'apiEndpoints',
    createInstance: (namespace) =>
      new ApiEndpointClass(
        namespace.name('api-endpoint-service'),
        namespace.name('api-endpoint')
      ),
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

const propertyTypeCache = new Map<string, Promise<PropertyType>>();
const JSON_PATCH_HEADERS = {
  'Content-Type': 'application/json-patch+json',
};

const parseSuccessfulResponse = async <ResponseBody>(
  response: APIResponse
): Promise<ResponseBody> => {
  const responseText = await response.text();

  expect(response.ok(), responseText).toBe(true);

  return JSON.parse(responseText) as ResponseBody;
};

const expectSuccessfulResponse = async (response: APIResponse) => {
  const responseText = await response.text();

  expect(response.ok(), responseText).toBe(true);
};

const getPropertyType = (
  apiContext: APIRequestContext,
  typeName: string
): Promise<PropertyType> => {
  let propertyType = propertyTypeCache.get(typeName);

  if (!propertyType) {
    propertyType = apiContext
      .get(`/api/v1/metadata/types/name/${typeName}`)
      .then((response) => parseSuccessfulResponse<PropertyType>(response));
    propertyTypeCache.set(typeName, propertyType);
  }

  return propertyType;
};

const getEntityType = async (
  apiContext: APIRequestContext,
  entityType: string
) => {
  const response = await apiContext.get(
    `/api/v1/metadata/types/name/${entityType}?fields=customProperties`
  );

  return parseSuccessfulResponse<EntityType>(response);
};

const getCustomProperty = (entityType: EntityType, propertyName: string) => {
  return entityType.customProperties?.find(
    (customProperty) => customProperty.name === propertyName
  );
};

const getCustomPropertyIndex = (
  entityType: EntityType,
  propertyName: string
) => {
  return (
    entityType.customProperties?.findIndex(
      (customProperty) => customProperty.name === propertyName
    ) ?? -1
  );
};

const expectPersistedValue = (actual: unknown, expected: unknown) => {
  if (typeof expected === 'object' && expected !== null) {
    expect(actual).toMatchObject(expected);

    return;
  }

  expect(actual).toEqual(expected);
};

const patchEntityType = async ({
  apiContext,
  entityTypeId,
  data,
}: {
  apiContext: APIRequestContext;
  entityTypeId: string;
  data: Array<{
    op: 'remove' | 'replace' | 'test';
    path: string;
    value?: unknown;
  }>;
}) => {
  return apiContext.patch(`/api/v1/metadata/types/${entityTypeId}`, {
    data,
    headers: JSON_PATCH_HEADERS,
  });
};

const removeCustomProperty = async ({
  apiContext,
  entityTypeId,
  entityTypeName,
  propertyName,
}: {
  apiContext: APIRequestContext;
  entityTypeId: string;
  entityTypeName: string;
  propertyName: string;
}) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const currentEntityType = await getEntityType(apiContext, entityTypeName);
    const propertyIndex = getCustomPropertyIndex(
      currentEntityType,
      propertyName
    );

    if (propertyIndex === -1) {
      return;
    }

    const response = await patchEntityType({
      apiContext,
      entityTypeId,
      data: [
        {
          op: 'test',
          path: `/customProperties/${propertyIndex}/name`,
          value: propertyName,
        },
        { op: 'remove', path: `/customProperties/${propertyIndex}` },
      ],
    });

    if (response.ok()) {
      await response.dispose();

      return;
    }

    await response.dispose();
  }

  throw new Error(
    `Unable to remove custom property ${entityTypeName}.${propertyName}`
  );
};

const createReferenceUser = async (
  apiContext: APIRequestContext,
  namespace: TestNamespace
) => {
  const userName = namespace.name('reference-user');
  const response = await apiContext.post('/api/v1/users/signup', {
    data: {
      email: `${userName}@example.com`,
      firstName: 'Contract',
      lastName: 'Reference',
      password: 'User@OMD123',
    },
  });
  const responseText = await response.text();

  if (response.ok()) {
    return JSON.parse(responseText) as { id: string; name: string };
  }

  if (
    response.status() === 400 &&
    responseText.includes('User with Email Already Exists')
  ) {
    return parseSuccessfulResponse<{ id: string; name: string }>(
      await apiContext.get(`/api/v1/users/name/${encodeURIComponent(userName)}`)
    );
  }

  throw new Error(`Unable to create reference user: ${responseText}`);
};

const getLoggedInUserReference = async (apiContext: APIRequestContext) => {
  const response = await apiContext.get('/api/v1/users/loggedInUser');
  const user = await parseSuccessfulResponse<{ id: string }>(response);

  return { id: user.id, type: 'user' } as const;
};

const getEntityIdentity = (instance: EntityInstance) => {
  const identity = instance.entityResponseData ?? instance.responseData;

  if (!identity?.id) {
    throw new Error('Created entity is missing its id');
  }

  return identity;
};

const readEntityExtension = async (
  apiContext: APIRequestContext,
  resourcePath: string
) => {
  const separator = resourcePath.includes('?') ? '&' : '?';
  const response = await apiContext.get(
    `${resourcePath}${separator}fields=extension`
  );
  const entity = await parseSuccessfulResponse<{
    extension?: Record<string, unknown>;
  }>(response);

  return entity.extension ?? {};
};

const createEntityValueTarget = (
  apiContext: APIRequestContext,
  resourcePath: string
): ValueTarget => {
  const getExtension = () => readEntityExtension(apiContext, resourcePath);

  return {
    getExtension,
    removeValue: async (propertyName) => {
      const extension = await getExtension();

      if (!(propertyName in extension)) {
        return;
      }

      await expectSuccessfulResponse(
        await apiContext.patch(resourcePath, {
          data: [{ op: 'remove', path: `/extension/${propertyName}` }],
          headers: JSON_PATCH_HEADERS,
        })
      );
    },
    setValue: async (propertyName, value) => {
      const extension = await getExtension();
      const hasExtension = Object.keys(extension).length > 0;
      const hasValue = propertyName in extension;
      const data = hasExtension
        ? [
            {
              op: hasValue ? 'replace' : 'add',
              path: `/extension/${propertyName}`,
              value,
            },
          ]
        : [
            {
              op: 'add',
              path: '/extension',
              value: { [propertyName]: value },
            },
          ];

      await expectSuccessfulResponse(
        await apiContext.patch(resourcePath, {
          data,
          headers: JSON_PATCH_HEADERS,
        })
      );
    },
  };
};

const createColumnValueTarget = (
  apiContext: APIRequestContext,
  columnFqn: string
): ValueTarget => {
  const resourcePath = `/api/v1/columns/name/${encodeURIComponent(
    columnFqn
  )}?entityType=table`;
  const getExtension = () => readEntityExtension(apiContext, resourcePath);
  const writeExtension = async (extension: Record<string, unknown>) => {
    await expectSuccessfulResponse(
      await apiContext.put(resourcePath, { data: { extension } })
    );
  };

  return {
    getExtension,
    removeValue: async (propertyName) => {
      const extension = await getExtension();

      if (!(propertyName in extension)) {
        return;
      }

      delete extension[propertyName];
      await writeExtension(extension);
    },
    setValue: async (propertyName, value) => {
      const extension = await getExtension();

      await writeExtension({ ...extension, [propertyName]: value });
    },
  };
};

const resolvePropertyValues = (
  variant: PropertyVariant,
  references: {
    initial: EntityReference;
    updated: EntityReference;
  }
) => {
  return typeof variant.values === 'function'
    ? variant.values(references)
    : variant.values;
};

const exerciseEntityContract = async ({
  adminApiContext,
  contract,
  testNamespace,
}: {
  adminApiContext: APIRequestContext;
  contract: EntityContract;
  testNamespace: TestNamespace;
}) => {
  const referenceUser = await createReferenceUser(
    adminApiContext,
    testNamespace
  );
  const instance = contract.createInstance(testNamespace);

  testNamespace.registerCleanup(async () => {
    await adminApiContext.delete(
      `/api/v1/users/${referenceUser.id}?recursive=false&hardDelete=true`
    );
  });
  testNamespace.registerCleanup(async () => {
    try {
      await instance.delete(adminApiContext);
    } finally {
      await contract.deleteRelated?.(adminApiContext, instance);
    }
  });

  await instance.create(adminApiContext);

  const identity = getEntityIdentity(instance);
  const target = createEntityValueTarget(
    adminApiContext,
    `/api/v1/${contract.apiPath}/${identity.id}`
  );
  const entityType = await getEntityType(adminApiContext, contract.typeName);
  const pendingPropertyNames = new Set<string>();
  const pendingValueNames = new Set<string>();

  testNamespace.registerCleanup(async () => {
    for (const propertyName of pendingPropertyNames) {
      await removeCustomProperty({
        apiContext: adminApiContext,
        entityTypeId: entityType.id,
        entityTypeName: contract.typeName,
        propertyName,
      });
    }
  });
  testNamespace.registerCleanup(async () => {
    for (const propertyName of pendingValueNames) {
      await target.removeValue(propertyName);
    }
  });

  await exercisePropertyVariants({
    adminApiContext,
    entityType,
    entityTypeName: contract.typeName,
    pendingPropertyNames,
    pendingValueNames,
    references: {
      initial: await getLoggedInUserReference(adminApiContext),
      updated: { id: referenceUser.id, type: 'user' },
    },
    target,
    testNamespace,
  });
};

const exerciseTableColumnContract = async ({
  adminApiContext,
  testNamespace,
}: {
  adminApiContext: APIRequestContext;
  testNamespace: TestNamespace;
}) => {
  const referenceUser = await createReferenceUser(
    adminApiContext,
    testNamespace
  );
  const table = new TableClass(testNamespace.name('column-contract-table'));

  testNamespace.registerCleanup(async () => {
    await adminApiContext.delete(
      `/api/v1/users/${referenceUser.id}?recursive=false&hardDelete=true`
    );
  });
  testNamespace.registerCleanup(async () => {
    await table.delete(adminApiContext);
  });

  await table.create(adminApiContext);

  const columnFqn = table.entityResponseData.columns[0].fullyQualifiedName;

  if (!columnFqn) {
    throw new Error('Created table column is missing its fully qualified name');
  }

  const target = createColumnValueTarget(adminApiContext, columnFqn);
  const entityType = await getEntityType(adminApiContext, 'tableColumn');
  const pendingPropertyNames = new Set<string>();
  const pendingValueNames = new Set<string>();

  testNamespace.registerCleanup(async () => {
    for (const propertyName of pendingPropertyNames) {
      await removeCustomProperty({
        apiContext: adminApiContext,
        entityTypeId: entityType.id,
        entityTypeName: 'tableColumn',
        propertyName,
      });
    }
  });
  testNamespace.registerCleanup(async () => {
    for (const propertyName of pendingValueNames) {
      await target.removeValue(propertyName);
    }
  });

  await exercisePropertyVariants({
    adminApiContext,
    entityType,
    entityTypeName: 'tableColumn',
    pendingPropertyNames,
    pendingValueNames,
    references: {
      initial: await getLoggedInUserReference(adminApiContext),
      updated: { id: referenceUser.id, type: 'user' },
    },
    target,
    testNamespace,
  });
};

const exercisePropertyVariants = async ({
  adminApiContext,
  entityType,
  entityTypeName,
  pendingPropertyNames,
  pendingValueNames,
  references,
  target,
  testNamespace,
}: {
  adminApiContext: APIRequestContext;
  entityType: EntityType;
  entityTypeName: string;
  pendingPropertyNames: Set<string>;
  pendingValueNames: Set<string>;
  references: {
    initial: EntityReference;
    updated: EntityReference;
  };
  target: ValueTarget;
  testNamespace: TestNamespace;
}) => {
  for (const variant of REMOVED_PROPERTY_VARIANTS) {
    await test.step(`${variant.typeName} value create, read, update, and delete`, async () => {
      const propertyName = testNamespace.name(variant.label);
      const propertyType = await getPropertyType(
        adminApiContext,
        variant.typeName
      );
      const customProperty = {
        name: propertyName,
        description: `${entityTypeName} ${variant.typeName} value contract`,
        propertyType: {
          id: propertyType.id,
          type: 'type',
        },
        ...(variant.config === undefined
          ? {}
          : {
              customPropertyConfig: {
                config: variant.config,
              },
            }),
      };
      const values = resolvePropertyValues(variant, references);

      pendingPropertyNames.add(propertyName);

      const createdType = await parseSuccessfulResponse<EntityType>(
        await adminApiContext.put(`/api/v1/metadata/types/${entityType.id}`, {
          data: customProperty,
        })
      );
      const createdProperty = getCustomProperty(createdType, propertyName);

      expect(createdProperty).toBeDefined();
      expect(createdProperty?.propertyType.id).toBe(propertyType.id);

      pendingValueNames.add(propertyName);
      await target.setValue(propertyName, values.initial);
      expectPersistedValue(
        (await target.getExtension())[propertyName],
        values.initial
      );

      await target.setValue(propertyName, values.updated);
      expectPersistedValue(
        (await target.getExtension())[propertyName],
        values.updated
      );

      await target.removeValue(propertyName);
      expect((await target.getExtension())[propertyName]).toBeUndefined();
      pendingValueNames.delete(propertyName);

      await removeCustomProperty({
        apiContext: adminApiContext,
        entityTypeId: entityType.id,
        entityTypeName,
        propertyName,
      });
      expect(
        getCustomProperty(
          await getEntityType(adminApiContext, entityTypeName),
          propertyName
        )
      ).toBeUndefined();
      pendingPropertyNames.delete(propertyName);
    });
  }
};

test.describe('Custom property instance-value API compatibility contract', () => {
  for (const contract of ENTITY_CONTRACTS) {
    test(`${contract.typeName} supports removed property value variants`, async ({
      adminApiContext,
      testNamespace,
    }) => {
      test.setTimeout(300_000);

      await exerciseEntityContract({
        adminApiContext,
        contract,
        testNamespace,
      });
    });
  }

  test('tableColumn supports removed property value variants', async ({
    adminApiContext,
    testNamespace,
  }) => {
    test.setTimeout(300_000);

    await exerciseTableColumnContract({
      adminApiContext,
      testNamespace,
    });
  });
});

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
