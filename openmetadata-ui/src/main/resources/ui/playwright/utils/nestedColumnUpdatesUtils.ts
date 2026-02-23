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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { DataType as FileDataType } from '../../src/generated/entity/data/file';
import { DataType as SearchIndexDataType } from '../../src/generated/entity/data/searchIndex';
import { DataType as TableDataType } from '../../src/generated/entity/data/table';
import { DataTypeTopic } from '../../src/generated/entity/data/topic';
import { DataType as WorksheetDataType } from '../../src/generated/entity/data/worksheet';
import { nestedChildrenTestData } from '../constant/nestedColumnUpdates';
import { FileClass } from '../support/entity/FileClass';
import { WorksheetClass } from '../support/entity/WorksheetClass';
import { uuid } from './common';
import { visitEntityPage } from './entity';

type EntityTypes = InstanceType<
  typeof nestedChildrenTestData[keyof typeof nestedChildrenTestData]['CreationClass']
>;

export const getNestedColumnDetails = (type: string, data: EntityTypes) => {
  const entityData = data.entityResponseData as any;
  const fqn = entityData.fullyQualifiedName;

  switch (type) {
    case 'API Endpoint': {
      const field0 = entityData.requestSchema.schemaFields[0];
      const field1 = field0.children[0];
      const field2 = field1.children[0];
      return {
        level0Key:
          field0.fullyQualifiedName ?? `${fqn}.requestSchema.${field0.name}`,
        level1Key:
          field1.fullyQualifiedName ??
          `${fqn}.requestSchema.${field0.name}.${field1.name}`,
        level2Key:
          field2.fullyQualifiedName ??
          `${fqn}.requestSchema.${field0.name}.${field1.name}.${field2.name}`,
        expand: true,
      };
    }
    case 'Topic': {
      const field0 = entityData.messageSchema.schemaFields[0];
      const field1 = field0.children[0];
      const field2 = field1.children[0];
      return {
        level0Key: field0.fullyQualifiedName ?? field0.name,
        level1Key: field1.fullyQualifiedName ?? field1.name,
        level2Key: field2.fullyQualifiedName ?? field2.name,
        expand: false,
      };
    }
    case 'Data Model': {
      const field0 = entityData.columns[1];
      const field1 = field0.children[0];
      const field2 = field1.children[0];
      return {
        level0Key: field0.fullyQualifiedName ?? `${fqn}.${field0.name}`,
        level1Key:
          field1.fullyQualifiedName ?? `${fqn}.${field0.name}.${field1.name}`,
        level2Key:
          field2.fullyQualifiedName ??
          `${fqn}.${field0.name}.${field1.name}.${field2.name}`,
        expand: true,
      };
    }
    case 'File':
    case 'Worksheet': {
      const field0 = entityData.columns[1];
      const field1 = field0.children[0];
      const field2 = field1.children[0];
      return {
        level0Key: field0.fullyQualifiedName ?? `${fqn}.${field0.name}`,
        level1Key:
          field1.fullyQualifiedName ?? `${fqn}.${field0.name}.${field1.name}`,
        level2Key:
          field2.fullyQualifiedName ??
          `${fqn}.${field0.name}.${field1.name}.${field2.name}`,
        expand: true,
      };
    }
    case 'Search Index': {
      const field0 = entityData.fields[3];
      const field1 = field0.children[0];
      const field2 = field1.children[0];
      return {
        level0Key: field0.fullyQualifiedName ?? `${fqn}.${field0.name}`,
        level1Key:
          field1.fullyQualifiedName ?? `${fqn}.${field0.name}.${field1.name}`,
        level2Key:
          field2.fullyQualifiedName ??
          `${fqn}.${field0.name}.${field1.name}.${field2.name}`,
        expand: true,
      };
    }
    case 'Table': {
      const field0 = entityData.columns[2];
      const field1 = field0.children[1];
      const field2 = field1.children[0];
      return {
        level0Key: field0.fullyQualifiedName ?? `${fqn}.${field0.name}`,
        level1Key:
          field1.fullyQualifiedName ?? `${fqn}.${field0.name}.${field1.name}`,
        level2Key:
          field2.fullyQualifiedName ??
          `${fqn}.${field0.name}.${field1.name}.${field2.name}`,
        expand: false,
      };
    }
    default:
      return { level0Key: '', level1Key: '', level2Key: '', expand: true };
  }
};

const DUPLICATE_NAME = `name-${uuid()}`;

const expandNestedColumn = async (
  page: Page,
  rowKey: string,
  childKey: string
) => {
  const expandIcon = page.locator(
    `[data-row-key="${rowKey}"] [data-testid="expand-icon"]`
  );
  await expect(expandIcon).toBeVisible();
  const childRow = page.locator(`[data-row-key="${childKey}"]`);
  if (await childRow.isVisible()) {
    return;
  }
  await page.waitForLoadState('domcontentloaded');
  await expandIcon.scrollIntoViewIfNeeded();
  await expandIcon.click();
};

const collapseNestedColumn = async (
  page: Page,
  rowKey: string,
  childKey: string
) => {
  const expandIcon = page.locator(
    `[data-row-key="${rowKey}"] [data-testid="expand-icon"]`
  );
  await expect(expandIcon).toBeVisible();
  const childRow = page.locator(`[data-row-key="${childKey}"]`);
  if (!(await childRow.isVisible())) {
    return;
  }
  await page.waitForLoadState('domcontentloaded');
  await expandIcon.scrollIntoViewIfNeeded();
  await expandIcon.click();
};

export const verifyExpandCollapseForSummaryPanel = async (page: Page) => {
  // Check expand/collapse inside summary panel
  const getExpandButton = (rowKey: string) =>
    page
      .getByRole('cell', { name: `Expand row ${rowKey}` })
      .getByRole('button', { name: 'Expand row' });

  const getCollapseButton = (rowKey: string) =>
    page
      .getByRole('cell', { name: `Collapse row ${rowKey}` })
      .getByRole('button', { name: 'Collapse row' });

  // 1. Expand Level 0
  await getExpandButton('default').click();

  // 2. Expand Level 1
  await expect(getExpandButton(DUPLICATE_NAME)).toBeVisible();
  await getExpandButton(DUPLICATE_NAME).click();

  await expect(page.getByText(DUPLICATE_NAME)).toHaveCount(3);

  // 4. Collapse Level 1
  await getCollapseButton(DUPLICATE_NAME).click();

  // 5. Verify 2 instances
  await expect(page.getByText(DUPLICATE_NAME)).toHaveCount(2);
};

export const verifyExpandCollapseNoDuplication = async (
  page: Page,
  opts: {
    level0Key: string;
    level1Key: string;
    level2Key: string;
    expandLevel0: boolean;
  }
) => {
  const { level0Key, level1Key, level2Key, expandLevel0 } = opts;

  if (expandLevel0) {
    await expandNestedColumn(page, level0Key, level1Key);
  }

  await expandNestedColumn(page, level1Key, level2Key);
  await expect(page.locator(`[data-row-key="${level1Key}"]`)).toBeVisible();
  await expect(page.locator(`[data-row-key="${level1Key}"]`)).toHaveCount(1);
  await expect(page.getByText(DUPLICATE_NAME)).toHaveCount(3);

  await collapseNestedColumn(page, level1Key, level2Key);
  await expect(page.locator(`[data-row-key="${level2Key}"]`)).not.toBeVisible();
  await expect(page.getByText(DUPLICATE_NAME)).toHaveCount(2);

  await expandNestedColumn(page, level1Key, level2Key);
  await expect(page.locator(`[data-row-key="${level2Key}"]`)).toBeVisible();
  await expect(page.locator(`[data-row-key="${level2Key}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-row-key="${level1Key}"]`)).toHaveCount(1);
  await expect(page.getByText(DUPLICATE_NAME)).toHaveCount(3);

  if (expandLevel0) {
    await collapseNestedColumn(page, level0Key, level1Key);
    await expect(
      page.locator(`[data-row-key="${level1Key}"]`)
    ).not.toBeVisible();

    await expandNestedColumn(page, level0Key, level1Key);
    await expect(page.locator(`[data-row-key="${level1Key}"]`)).toBeVisible();
    await expect(page.locator(`[data-row-key="${level1Key}"]`)).toHaveCount(1);
  }
};

// --- Entity creation helpers with duplicate column names ---

export const createTableEntity = async (apiContext: APIRequestContext) => {
  const id = uuid();
  const serviceName = `pw-nested-db-svc-${id}`;
  const dbName = `pw-nested-db-${id}`;
  const schemaName = `pw-nested-schema-${id}`;
  const tableName = `pw-nested-table-${id}`;

  const service = await apiContext
    .post('/api/v1/services/databaseServices', {
      data: {
        name: serviceName,
        serviceType: 'Mysql',
        connection: {
          config: {
            type: 'Mysql',
            scheme: 'mysql+pymysql',
            username: 'username',
            authType: { password: 'password' },
            hostPort: 'mysql:3306',
            supportsMetadataExtraction: true,
          },
        },
      },
    })
    .then((r) => r.json());

  const db = await apiContext
    .post('/api/v1/databases', {
      data: { name: dbName, service: service.fullyQualifiedName },
    })
    .then((r) => r.json());

  const schema = await apiContext
    .post('/api/v1/databaseSchemas', {
      data: { name: schemaName, database: db.fullyQualifiedName },
    })
    .then((r) => r.json());

  const columns = [
    {
      name: DUPLICATE_NAME,
      dataType: TableDataType.Varchar,
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'Top-level name column.',
    },
    {
      name: 'user_id',
      dataType: TableDataType.Numeric,
      dataTypeDisplay: 'numeric',
      description: 'User identifier.',
    },
    {
      name: 'details',
      dataType: TableDataType.Struct,
      dataLength: 100,
      dataTypeDisplay: 'struct',
      description: 'User details struct.',
      children: [
        {
          name: DUPLICATE_NAME,
          dataType: TableDataType.Struct,
          dataLength: 100,
          dataTypeDisplay: 'struct',
          description: 'Nested name struct (duplicate name).',
          children: [
            {
              name: 'first_name',
              dataType: TableDataType.Varchar,
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description: 'First name.',
            },
            {
              name: DUPLICATE_NAME,
              dataType: TableDataType.Varchar,
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description: 'Duplicate name field.',
            },
          ],
        },
      ],
    },
  ];

  const entity = await apiContext
    .post('/api/v1/tables', {
      data: {
        name: tableName,
        displayName: tableName,
        description: 'Table with duplicate nested column names for testing.',
        columns,
        tableType: 'Regular',
        databaseSchema: schema.fullyQualifiedName,
      },
    })
    .then((r) => r.json());

  const fqn = entity.fullyQualifiedName;

  return {
    entity,
    service,
    deleteService: () =>
      apiContext.delete(
        `/api/v1/services/databaseServices/name/${encodeURIComponent(
          service.fullyQualifiedName
        )}?recursive=true&hardDelete=true`
      ),
    visitPage: async (page: Page) => {
      await visitEntityPage({
        page,
        searchTerm: fqn,
        dataTestId: `${service.name}-${entity.name}`,
      });
    },
    keys: {
      level0Key: `${fqn}.details`,
      level1Key: `${fqn}.details.${DUPLICATE_NAME}`,
      level2Key: `${fqn}.details.${DUPLICATE_NAME}.${DUPLICATE_NAME}`,
      expandLevel0: false,
    },
  };
};

export const createTopicEntity = async (apiContext: APIRequestContext) => {
  const id = uuid();
  const serviceName = `pw-nested-msg-svc-${id}`;
  const topicName = `pw-nested-topic-${id}`;

  const service = await apiContext
    .post('/api/v1/services/messagingServices', {
      data: {
        name: serviceName,
        serviceType: 'Kafka',
        connection: {
          config: {
            type: 'Kafka',
            bootstrapServers: 'Bootstrap Servers',
            saslUsername: 'admin',
            saslPassword: 'admin',
            saslMechanism: 'PLAIN',
            supportsMetadataExtraction: true,
          },
        },
      },
    })
    .then((r) => r.json());

  const schemaFields = [
    {
      name: 'default',
      dataType: DataTypeTopic.Record,
      tags: [],
      children: [
        {
          name: DUPLICATE_NAME,
          dataType: DataTypeTopic.Record,
          tags: [],
          children: [
            {
              name: 'first_name',
              dataType: DataTypeTopic.String,
              description: 'First name field.',
              tags: [],
            },
            {
              name: DUPLICATE_NAME,
              dataType: DataTypeTopic.String,
              description: 'Duplicate name field.',
              tags: [],
            },
          ],
        },
        {
          name: 'age',
          dataType: DataTypeTopic.Int,
          tags: [],
        },
      ],
    },
    {
      name: DUPLICATE_NAME,
      dataType: DataTypeTopic.String,
      tags: [],
    },
  ];

  const entity = await apiContext
    .post('/api/v1/topics', {
      data: {
        name: topicName,
        displayName: topicName,
        service: serviceName,
        description: 'Topic with duplicate nested column names for testing.',
        messageSchema: {
          schemaText: '{}',
          schemaType: 'JSON',
          schemaFields,
        },
        partitions: 1,
      },
    })
    .then((r) => r.json());

  const fqn = entity.fullyQualifiedName;

  return {
    entity,
    service,
    deleteService: () =>
      apiContext.delete(
        `/api/v1/services/messagingServices/name/${encodeURIComponent(
          service.fullyQualifiedName
        )}?recursive=true&hardDelete=true`
      ),
    visitPage: async (page: Page) => {
      await visitEntityPage({
        page,
        searchTerm: fqn,
        dataTestId: `${service.name}-${entity.name}`,
      });
    },
    keys: {
      level0Key: `${fqn}.default`,
      level1Key: `${fqn}.default.${DUPLICATE_NAME}`,
      level2Key: `${fqn}.default.${DUPLICATE_NAME}.${DUPLICATE_NAME}`,
      expandLevel0: false,
    },
  };
};

export const createApiEndpointEntity = async (
  apiContext: APIRequestContext
) => {
  const id = uuid();
  const serviceName = `pw-nested-api-svc-${id}`;
  const collectionName = `pw-nested-api-col-${id}`;
  const endpointName = `pw-nested-api-ep-${id}`;
  const fqnPrefix = `${serviceName}.${collectionName}.${endpointName}.requestSchema`;

  const service = await apiContext
    .post('/api/v1/services/apiServices', {
      data: {
        name: serviceName,
        displayName: serviceName,
        serviceType: 'Rest',
        connection: {
          config: {
            type: 'Rest',
            openAPISchemaConnection: {
              openAPISchemaURL:
                'https://sandbox-beta.open-metadata.org/swagger.json',
            },
          },
        },
      },
    })
    .then((r) => r.json());

  await apiContext
    .post('/api/v1/apiCollections', {
      data: {
        name: collectionName,
        displayName: collectionName,
        service: serviceName,
      },
    })
    .then((r) => r.json());

  const schemaFields = [
    {
      name: 'default',
      dataType: DataTypeTopic.Record,
      fullyQualifiedName: `${fqnPrefix}.default`,
      tags: [],
      children: [
        {
          name: DUPLICATE_NAME,
          dataType: DataTypeTopic.Record,
          fullyQualifiedName: `${fqnPrefix}.default.${DUPLICATE_NAME}`,
          tags: [],
          children: [
            {
              name: 'first_name',
              dataType: DataTypeTopic.String,
              description: 'First name.',
              fullyQualifiedName: `${fqnPrefix}.default.${DUPLICATE_NAME}.first_name`,
              tags: [],
            },
            {
              name: DUPLICATE_NAME,
              dataType: DataTypeTopic.String,
              description: 'Duplicate name field.',
              fullyQualifiedName: `${fqnPrefix}.default.${DUPLICATE_NAME}.${DUPLICATE_NAME}`,
              tags: [],
            },
          ],
        },
        {
          name: 'age',
          dataType: DataTypeTopic.Int,
          fullyQualifiedName: `${fqnPrefix}.default.age`,
          tags: [],
        },
      ],
    },
    {
      name: DUPLICATE_NAME,
      dataType: DataTypeTopic.String,
      fullyQualifiedName: `${fqnPrefix}.${DUPLICATE_NAME}`,
      tags: [],
    },
  ];

  const entity = await apiContext
    .post('/api/v1/apiEndpoints', {
      data: {
        name: endpointName,
        displayName: endpointName,
        apiCollection: `${serviceName}.${collectionName}`,
        endpointURL: 'https://sandbox-beta.open-metadata.org/swagger.json',
        description:
          'API Endpoint with duplicate nested column names for testing.',
        requestSchema: {
          schemaType: 'JSON',
          schemaFields,
        },
        responseSchema: {
          schemaType: 'JSON',
          schemaFields: [],
        },
      },
    })
    .then((r) => r.json());

  const fqn = entity.fullyQualifiedName;

  return {
    entity,
    service,
    deleteService: () =>
      apiContext.delete(
        `/api/v1/services/apiServices/name/${encodeURIComponent(
          service.fullyQualifiedName
        )}?recursive=true&hardDelete=true`
      ),
    visitPage: async (page: Page) => {
      await visitEntityPage({
        page,
        searchTerm: fqn,
        dataTestId: `${service.name}-${entity.name}`,
      });
    },
    keys: {
      level0Key: `${fqnPrefix}.default`,
      level1Key: `${fqnPrefix}.default.${DUPLICATE_NAME}`,
      level2Key: `${fqnPrefix}.default.${DUPLICATE_NAME}.${DUPLICATE_NAME}`,
      expandLevel0: true,
    },
  };
};

export const createDataModelEntity = async (apiContext: APIRequestContext) => {
  const id = uuid();
  const serviceName = `pw-nested-dash-svc-${id}`;
  const dataModelName = `pw-nested-dm-${id}`;

  const service = await apiContext
    .post('/api/v1/services/dashboardServices', {
      data: {
        name: serviceName,
        serviceType: 'Superset',
        connection: {
          config: {
            type: 'Superset',
            hostPort: 'http://localhost:8088',
            connection: {
              provider: 'ldap',
              username: 'admin',
              password: 'admin',
            },
            supportsMetadataExtraction: true,
          },
        },
      },
    })
    .then((r) => r.json());

  const columns = [
    {
      name: DUPLICATE_NAME,
      dataType: TableDataType.Varchar,
      dataLength: 256,
      dataTypeDisplay: 'varchar',
      description: 'Top-level name column.',
    },
    {
      name: 'user_details',
      dataType: TableDataType.Struct,
      dataLength: 256,
      dataTypeDisplay: 'struct',
      description: 'User details.',
      children: [
        {
          name: DUPLICATE_NAME,
          dataType: TableDataType.Struct,
          dataLength: 256,
          dataTypeDisplay: 'struct',
          description: 'Nested name (duplicate).',
          children: [
            {
              name: 'first_name',
              dataType: TableDataType.Varchar,
              dataLength: 256,
              dataTypeDisplay: 'varchar',
              description: 'First name.',
            },
            {
              name: DUPLICATE_NAME,
              dataType: TableDataType.Varchar,
              dataLength: 256,
              dataTypeDisplay: 'varchar',
              description: 'Duplicate name field.',
            },
          ],
        },
      ],
    },
  ];

  const entity = await apiContext
    .post('/api/v1/dashboard/datamodels', {
      data: {
        name: dataModelName,
        displayName: dataModelName,
        description:
          'Dashboard data model with duplicate nested column names for testing.',
        service: serviceName,
        columns,
        dataModelType: 'SupersetDataModel',
        project: `pw-project-${id}`,
      },
    })
    .then((r) => r.json());

  const fqn = entity.fullyQualifiedName;

  return {
    entity,
    service,
    deleteService: () =>
      apiContext.delete(
        `/api/v1/services/dashboardServices/name/${encodeURIComponent(
          service.fullyQualifiedName
        )}?recursive=true&hardDelete=true`
      ),
    visitPage: async (page: Page) => {
      await visitEntityPage({
        page,
        searchTerm: fqn,
        dataTestId: `${service.name}-${entity.name}`,
      });
    },
    keys: {
      level0Key: `${fqn}.user_details`,
      level1Key: `${fqn}.user_details.${DUPLICATE_NAME}`,
      level2Key: `${fqn}.user_details.${DUPLICATE_NAME}.${DUPLICATE_NAME}`,
      expandLevel0: true,
    },
  };
};

export const createContainerEntity = async (apiContext: APIRequestContext) => {
  const id = uuid();
  const serviceName = `pw-nested-storage-svc-${id}`;
  const containerName = `pw-nested-container-${id}`;

  const service = await apiContext
    .post('/api/v1/services/storageServices', {
      data: {
        name: serviceName,
        serviceType: 'S3',
        connection: {
          config: {
            type: 'S3',
            awsConfig: {
              awsAccessKeyId: 'admin',
              awsSecretAccessKey: 'key',
              awsRegion: 'us-east-2',
              assumeRoleSessionName: 'OpenMetadataSession',
            },
            supportsMetadataExtraction: true,
          },
        },
      },
    })
    .then((r) => r.json());

  const columns = [
    {
      name: DUPLICATE_NAME,
      dataType: TableDataType.Varchar,
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'Top-level name column.',
      tags: [],
      ordinalPosition: 1,
    },
    {
      name: 'details',
      dataType: TableDataType.Struct,
      dataLength: 100,
      dataTypeDisplay: 'struct',
      description: 'Details struct with nested duplicate name.',
      tags: [],
      ordinalPosition: 2,
      children: [
        {
          name: DUPLICATE_NAME,
          dataType: TableDataType.Struct,
          dataLength: 100,
          dataTypeDisplay: 'struct',
          description: 'Nested name struct (duplicate).',
          tags: [],
          children: [
            {
              name: 'first_name',
              dataType: TableDataType.Varchar,
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description: 'First name.',
              tags: [],
            },
            {
              name: DUPLICATE_NAME,
              dataType: TableDataType.Varchar,
              dataLength: 100,
              dataTypeDisplay: 'varchar',
              description: 'Duplicate name field.',
              tags: [],
            },
          ],
        },
      ],
    },
  ];

  const entity = await apiContext
    .post('/api/v1/containers', {
      data: {
        name: containerName,
        displayName: containerName,
        service: serviceName,
        description:
          'Container with duplicate nested column names for testing.',
        dataModel: {
          isPartitioned: false,
          columns,
        },
      },
    })
    .then((r) => r.json());

  const fqn = entity.fullyQualifiedName;

  return {
    entity,
    service,
    deleteService: () =>
      apiContext.delete(
        `/api/v1/services/storageServices/name/${encodeURIComponent(
          service.fullyQualifiedName
        )}?recursive=true&hardDelete=true`
      ),
    visitPage: async (page: Page) => {
      await visitEntityPage({
        page,
        searchTerm: fqn,
        dataTestId: `${service.name}-${entity.name}`,
      });
    },
    keys: {
      level0Key: `${fqn}.details`,
      level1Key: `${fqn}.details.${DUPLICATE_NAME}`,
      level2Key: `${fqn}.details.${DUPLICATE_NAME}.${DUPLICATE_NAME}`,
      expandLevel0: true,
    },
  };
};

export const createSearchIndexEntity = async (
  apiContext: APIRequestContext
) => {
  const id = uuid();
  const serviceName = `pw-nested-search-svc-${id}`;
  const searchIndexName = `pw-nested-si-${id}`;

  const service = await apiContext
    .post('/api/v1/services/searchServices', {
      data: {
        name: serviceName,
        serviceType: 'ElasticSearch',
        connection: {
          config: {
            type: 'ElasticSearch',
            hostPort: 'elasticsearch:9200',
            authType: {
              username: 'admin',
              password: 'admin',
            },
            connectionTimeoutSecs: 30,
            supportsMetadataExtraction: true,
          },
        },
      },
    })
    .then((r) => r.json());

  const fields = [
    {
      name: DUPLICATE_NAME,
      dataType: SearchIndexDataType.Text,
      dataTypeDisplay: 'text',
      description: 'Top-level name column.',
    },
    {
      name: 'details',
      dataType: SearchIndexDataType.Nested,
      dataTypeDisplay: 'nested',
      description: 'User details struct.',
      children: [
        {
          name: DUPLICATE_NAME,
          dataType: SearchIndexDataType.Nested,
          dataTypeDisplay: 'nested',
          description: 'Nested name struct (duplicate name).',
          children: [
            {
              name: 'first_name',
              dataType: SearchIndexDataType.Text,
              dataTypeDisplay: 'text',
              description: 'First name.',
            },
            {
              name: DUPLICATE_NAME,
              dataType: SearchIndexDataType.Text,
              dataTypeDisplay: 'text',
              description: 'Duplicate name field.',
            },
          ],
        },
      ],
    },
  ];

  const entity = await apiContext
    .post('/api/v1/searchIndexes', {
      data: {
        name: searchIndexName,
        displayName: searchIndexName,
        description: 'Search Index with duplicate nested fields for testing.',
        service: serviceName,
        fields,
      },
    })
    .then((r) => r.json());

  const fqn = entity.fullyQualifiedName;

  return {
    entity,
    service,
    deleteService: () =>
      apiContext.delete(
        `/api/v1/services/searchServices/name/${encodeURIComponent(
          service.fullyQualifiedName
        )}?recursive=true&hardDelete=true`
      ),
    visitPage: async (page: Page) => {
      await visitEntityPage({
        page,
        searchTerm: fqn,
        dataTestId: `${service.name}-${entity.name}`,
      });
    },
    keys: {
      level0Key: `${fqn}.details`,
      level1Key: `${fqn}.details.${DUPLICATE_NAME}`,
      level2Key: `${fqn}.details.${DUPLICATE_NAME}.${DUPLICATE_NAME}`,
      expandLevel0: true,
    },
  };
};

export const createWorksheetEntity = async (apiContext: APIRequestContext) => {
  const worksheetClass = new WorksheetClass();
  const columns = [
    {
      name: DUPLICATE_NAME,
      displayName: '',
      dataType: WorksheetDataType.String,
      dataTypeDisplay: 'string',
      description: 'Top-level column.',
    },
    {
      name: 'details',
      displayName: 'details',
      dataType: WorksheetDataType.Struct,
      dataTypeDisplay: 'struct',
      description: 'Details struct.',
      children: [
        {
          name: DUPLICATE_NAME,
          displayName: '',
          dataType: WorksheetDataType.Struct,
          dataTypeDisplay: 'struct',
          description: 'Nested name struct.',
          children: [
            {
              name: 'first_name',
              displayName: 'first_name',
              dataType: WorksheetDataType.String,
              dataTypeDisplay: 'string',
              description: 'First name.',
            },
            {
              name: DUPLICATE_NAME,
              displayName: '',
              dataType: WorksheetDataType.String,
              dataTypeDisplay: 'string',
              description: 'Duplicate name field.',
            },
          ],
        },
      ],
    },
  ];

  worksheetClass.entity.columns = columns;

  await worksheetClass.create(apiContext);
  const data = worksheetClass.get();
  const entity = data.entity;
  const service = data.service;
  const fqn = entity.fullyQualifiedName;

  return {
    entity,
    service,
    deleteService: () =>
      worksheetClass.delete(apiContext).then(() => ({} as any)),
    visitPage: async (page: Page) => {
      await worksheetClass.visitEntityPage(page);
    },
    keys: {
      level0Key: `${fqn}.details`,
      level1Key: `${fqn}.details.${DUPLICATE_NAME}`,
      level2Key: `${fqn}.details.${DUPLICATE_NAME}.${DUPLICATE_NAME}`,
      expandLevel0: true,
    },
  };
};

export const createFileEntity = async (apiContext: APIRequestContext) => {
  const fileClass = new FileClass();
  const columns = [
    {
      name: DUPLICATE_NAME,
      displayName: '',
      dataType: FileDataType.String,
      dataTypeDisplay: 'string',
      description: 'Top-level column.',
    },
    {
      name: 'details',
      displayName: 'details',
      dataType: FileDataType.Struct,
      dataTypeDisplay: 'struct',
      description: 'Details struct.',
      children: [
        {
          name: DUPLICATE_NAME,
          displayName: '',
          dataType: FileDataType.Struct,
          dataTypeDisplay: 'struct',
          description: 'Nested name struct.',
          children: [
            {
              name: 'first_name',
              displayName: 'first_name',
              dataType: FileDataType.String,
              dataTypeDisplay: 'string',
              description: 'First name.',
            },
            {
              name: DUPLICATE_NAME,
              displayName: '',
              dataType: FileDataType.String,
              dataTypeDisplay: 'string',
              description: 'Duplicate name field.',
            },
          ],
        },
      ],
    },
  ];

  fileClass.entity.columns = columns;

  await fileClass.create(apiContext);
  const data = fileClass.get();
  const entity = data.entity;
  const service = data.service;
  const fqn = entity.fullyQualifiedName;

  return {
    entity,
    service,
    deleteService: () => fileClass.delete(apiContext).then(() => ({} as any)),
    visitPage: async (page: Page) => {
      await fileClass.visitEntityPage(page);
      await page.getByTestId('schema').click();
      await page.waitForLoadState('domcontentloaded');
    },
    keys: {
      level0Key: `${fqn}.details`,
      level1Key: `${fqn}.details.${DUPLICATE_NAME}`,
      level2Key: `${fqn}.details.${DUPLICATE_NAME}.${DUPLICATE_NAME}`,
      expandLevel0: true,
    },
  };
};
