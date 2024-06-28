/*
 *  Copyright 2024 Collate.
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
import { APIRequestContext, Page } from '@playwright/test';
import { uuid } from '../../utils/common';
import { visitEntityPage } from '../../utils/entity';
import { EntityTypeEndpoint } from './Entity.interface';
import { EntityClass } from './EntityClass';

export class TableClass extends EntityClass {
  service = {
    name: `pw-database-service-${uuid()}`,
    serviceType: 'Mysql',
    connection: {
      config: {
        type: 'Mysql',
        scheme: 'mysql+pymysql',
        username: 'username',
        authType: {
          password: 'password',
        },
        hostPort: 'mysql:3306',
        supportsMetadataExtraction: true,
        supportsDBTExtraction: true,
        supportsProfiler: true,
        supportsQueryComment: true,
      },
    },
  };
  database = {
    name: `pw-database-${uuid()}`,
    service: this.service.name,
  };
  schema = {
    name: `pw-database-schema-${uuid()}`,
    database: `${this.service.name}.${this.database.name}`,
  };
  entity = {
    name: `pw-table-${uuid()}`,
    description: 'description',
    columns: [
      {
        name: 'user_id',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        description:
          'Unique identifier for the user of your Shopify POS or your Shopify admin.',
      },
      {
        name: 'shop_id',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        description:
          'The ID of the store. This column is a foreign key reference to the shop_id column in the dim.shop table.',
      },
      {
        name: 'name',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Name of the staff member.',
        children: [
          {
            name: 'first_name',
            dataType: 'VARCHAR',
            dataLength: 100,
            dataTypeDisplay: 'varchar',
            description: 'First name of the staff member.',
          },
          {
            name: 'last_name',
            dataType: 'VARCHAR',
            dataLength: 100,
            dataTypeDisplay: 'varchar',
          },
        ],
      },
      {
        name: 'email',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Email address of the staff member.',
      },
    ],
    databaseSchema: `${this.service.name}.${this.database.name}.${this.schema.name}`,
  };

  serviceResponseData: unknown;
  databaseResponseData: unknown;
  schemaResponseData: unknown;
  entityResponseData: unknown;

  constructor(name?: string) {
    super(EntityTypeEndpoint.Table);
    this.service.name = name ?? this.service.name;
    this.type = 'Table';
  }

  async create(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/databaseServices',
      {
        data: this.service,
      }
    );
    const databaseResponse = await apiContext.post('/api/v1/databases', {
      data: this.database,
    });
    const schemaResponse = await apiContext.post('/api/v1/databaseSchemas', {
      data: this.schema,
    });
    const entityResponse = await apiContext.post('/api/v1/tables', {
      data: this.entity,
    });

    const service = await serviceResponse.json();
    const database = await databaseResponse.json();
    const schema = await schemaResponse.json();
    const entity = await entityResponse.json();

    this.serviceResponseData = service;
    this.databaseResponseData = database;
    this.schemaResponseData = schema;
    this.entityResponseData = entity;

    return {
      service,
      database,
      schema,
      entity,
    };
  }

  get() {
    return {
      service: this.serviceResponseData,
      database: this.databaseResponseData,
      schema: this.schemaResponseData,
      entity: this.entityResponseData,
    };
  }

  async visitEntityPage(page: Page) {
    await visitEntityPage({
      page,
      searchTerm: this.entityResponseData?.['fullyQualifiedName'],
      dataTestId: `${this.service.name}-${this.entity.name}`,
    });
  }

  async createTestSuiteAndPipelines(apiContext: APIRequestContext) {
    if (!this.entityResponseData) {
      return Promise.reject('Entity not created');
    }

    const testSuiteData = await apiContext
      .post('/api/v1/dataQuality/testSuites/executable', {
        data: {
          name: `pw-test-suite-${uuid()}`,
          executableEntityReference:
            this.entityResponseData['fullyQualifiedName'],
          description: 'Playwright test suite for table',
        },
      })
      .then((res) => res.json());

    await apiContext.post(`/api/v1/services/ingestionPipelines`, {
      data: {
        airflowConfig: {},
        name: `${this.entityResponseData['fullyQualifiedName']}_test_suite`,
        pipelineType: 'TestSuite',
        service: {
          id: testSuiteData.id,
          type: 'testSuite',
        },
        sourceConfig: {
          config: {
            type: 'TestSuite',
            entityFullyQualifiedName:
              this.entityResponseData['fullyQualifiedName'],
          },
        },
      },
    });
  }

  async delete(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.delete(
      `/api/v1/services/databaseServices/name/${encodeURIComponent(
        this.serviceResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
    };
  }
}
