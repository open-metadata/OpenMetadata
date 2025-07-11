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
import { Operation } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { SERVICE_TYPE } from '../../constant/service';
import { ServiceTypes } from '../../constant/settings';
import { uuid } from '../../utils/common';
import {
  visitEntityPage,
  visitEntityPageWithCustomSearchBox,
} from '../../utils/entity';
import {
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
  TestCaseData,
  TestSuiteData,
} from './Entity.interface';
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
  columnsName = [
    `user_id${uuid()}`,
    `shop_id${uuid()}`,
    `name${uuid()}`,
    `first_name${uuid()}`,
    `last_name${uuid()}`,
    `email${uuid()}`,
  ];
  entityLinkColumnsName = [
    this.columnsName[0],
    this.columnsName[1],
    this.columnsName[2],
    `${this.columnsName[2]}.${this.columnsName[3]}`,
    `${this.columnsName[2]}.${this.columnsName[4]}`,
    this.columnsName[5],
  ];

  children = [
    {
      name: this.columnsName[0],
      dataType: 'NUMERIC',
      dataTypeDisplay: 'numeric',
      description:
        'Unique identifier for the user of your Shopify POS or your Shopify admin.',
    },
    {
      name: this.columnsName[1],
      dataType: 'NUMERIC',
      dataTypeDisplay: 'numeric',
      description:
        'The ID of the store. This column is a foreign key reference to the shop_id column in the dim.shop table.',
    },
    {
      name: this.columnsName[2],
      dataType: 'VARCHAR',
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'Name of the staff member.',
      children: [
        {
          name: this.columnsName[3],
          dataType: 'STRUCT',
          dataLength: 100,
          dataTypeDisplay:
            'struct<username:varchar(32),name:varchar(32),sex:char(1),address:varchar(128),mail:varchar(64),birthdate:varchar(16)>',
          description: 'First name of the staff member.',
        },
        {
          name: this.columnsName[4],
          dataType: 'ARRAY',
          dataLength: 100,
          dataTypeDisplay: 'array<struct<type:string,provider:array<int>>>',
        },
      ],
    },
    {
      name: this.columnsName[5],
      dataType: 'VARCHAR',
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'Email address of the staff member.',
    },
  ];

  entity = {
    name: `pw-table-${uuid()}`,
    displayName: `pw table ${uuid()}`,
    description: 'description',
    columns: this.children,
    tableType: 'SecureView',
    databaseSchema: `${this.service.name}.${this.database.name}.${this.schema.name}`,
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  databaseResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  schemaResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  testSuiteResponseData: ResponseDataType = {} as ResponseDataType;
  testSuitePipelineResponseData: ResponseDataType[] = [];
  testCasesResponseData: ResponseDataType[] = [];
  queryResponseData: ResponseDataType[] = [];
  additionalEntityTableResponseData: ResponseDataType[] = [];

  constructor(name?: string, tableType?: string) {
    super(EntityTypeEndpoint.Table);
    this.service.name = name ?? this.service.name;
    this.serviceCategory = SERVICE_TYPE.Database;
    this.serviceType = ServiceTypes.DATABASE_SERVICES;
    this.type = 'Table';
    this.childrenTabId = 'schema';
    this.entity.tableType = tableType ?? this.entity.tableType;
    this.childrenSelectorId = `${this.entity.databaseSchema}.${this.entity.name}.${this.children[0].name}`;
  }

  async create(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/databaseServices',
      {
        data: this.service,
      }
    );
    const service = await serviceResponse.json();

    const databaseResponse = await apiContext.post('/api/v1/databases', {
      data: { ...this.database, service: service.fullyQualifiedName },
    });
    const database = await databaseResponse.json();

    const schemaResponse = await apiContext.post('/api/v1/databaseSchemas', {
      data: { ...this.schema, database: database.fullyQualifiedName },
    });
    const schema = await schemaResponse.json();

    const entityResponse = await apiContext.post('/api/v1/tables', {
      data: {
        ...this.entity,
        databaseSchema: schema.fullyQualifiedName,
      },
    });

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

  async createAdditionalTable(
    tableData: {
      name: string;
      displayName: string;
      description?: string;
      columns?: any[];
      databaseSchema?: string;
    },
    apiContext: APIRequestContext
  ) {
    const entityResponse = await apiContext.post('/api/v1/tables', {
      data: {
        ...this.entity,
        ...tableData,
      },
    });
    const entity = await entityResponse.json();
    this.additionalEntityTableResponseData = [
      ...this.additionalEntityTableResponseData,
      entity,
    ];

    return entity;
  }

  get() {
    return {
      service: this.serviceResponseData,
      database: this.databaseResponseData,
      schema: this.schemaResponseData,
      entity: this.entityResponseData,
    };
  }

  async visitEntityPage(page: Page, searchTerm?: string) {
    await visitEntityPage({
      page,
      searchTerm: searchTerm ?? this.entityResponseData?.['fullyQualifiedName'],
      dataTestId: `${this.service.name}-${this.entity.name}`,
    });
  }

  async visitEntityPageWithCustomSearchBox(page: Page, searchTerm?: string) {
    await visitEntityPageWithCustomSearchBox({
      page,
      searchTerm: searchTerm ?? this.entityResponseData?.['fullyQualifiedName'],
      dataTestId: `${this.service.name}-${this.entity.name}`,
    });
  }

  async createQuery(apiContext: APIRequestContext, queryText?: string) {
    const queryResponse = await apiContext.post('/api/v1/queries', {
      data: {
        query:
          queryText ??
          `select * from ${this.entityResponseData?.['fullyQualifiedName']}`,
        queryUsedIn: [{ id: this.entityResponseData?.['id'], type: 'table' }],
        queryDate: Date.now(),
        service: this.serviceResponseData?.['name'],
      },
    });

    const query = await queryResponse.json();

    this.queryResponseData.push(query);

    return query;
  }

  async createTestSuiteAndPipelines(
    apiContext: APIRequestContext,
    testSuite?: TestSuiteData
  ) {
    if (isEmpty(this.entityResponseData)) {
      await this.create(apiContext);
    }

    const testSuiteData = await apiContext
      .post('/api/v1/dataQuality/testSuites/basic', {
        data: {
          name: `pw-test-suite-${uuid()}`,
          basicEntityReference: this.entityResponseData?.['fullyQualifiedName'],
          description: 'Playwright test suite for table',
          ...testSuite,
        },
      })
      .then((res) => res.json());

    this.testSuiteResponseData = testSuiteData;

    const pipeline = await this.createTestSuitePipeline(apiContext);

    return {
      testSuiteData,
      pipeline,
    };
  }

  async createTestSuitePipeline(
    apiContext: APIRequestContext,
    testCases?: string[]
  ) {
    const pipelineData = await apiContext
      .post(`/api/v1/services/ingestionPipelines`, {
        data: {
          airflowConfig: {
            scheduleInterval: '0 * * * *',
          },
          name: `pw-test-suite-pipeline-${uuid()}`,
          loggerLevel: 'INFO',
          pipelineType: 'TestSuite',
          service: {
            id: this.testSuiteResponseData?.['id'],
            type: 'testSuite',
          },
          sourceConfig: {
            config: {
              type: 'TestSuite',
              entityFullyQualifiedName:
                this.entityResponseData?.['fullyQualifiedName'],
              testCases,
            },
          },
        },
      })
      .then((res) => res.json());

    this.testSuitePipelineResponseData.push(pipelineData);

    return pipelineData;
  }

  async createTestCase(
    apiContext: APIRequestContext,
    testCaseData?: TestCaseData
  ) {
    if (isEmpty(this.testSuiteResponseData)) {
      await this.createTestSuiteAndPipelines(apiContext);
    }

    const testCase = await apiContext
      .post('/api/v1/dataQuality/testCases', {
        data: {
          name: `pw-test-case-${uuid()}`,
          entityLink: `<#E::table::${this.entityResponseData?.['fullyQualifiedName']}>`,
          testDefinition: 'tableRowCountToBeBetween',
          parameterValues: [
            { name: 'minValue', value: 12 },
            { name: 'maxValue', value: 34 },
          ],
          ...testCaseData,
        },
      })
      .then((res) => res.json());

    this.testCasesResponseData.push(testCase);

    return testCase;
  }

  async addTestCaseResult(
    apiContext: APIRequestContext,
    testCaseFqn: string,
    testCaseResult: unknown
  ) {
    const testCaseResultResponse = await apiContext.post(
      `/api/v1/dataQuality/testCases/testCaseResults/${testCaseFqn}`,
      { data: testCaseResult }
    );

    return await testCaseResultResponse.json();
  }

  async patch({
    apiContext,
    patchData,
  }: {
    apiContext: APIRequestContext;
    patchData: Operation[];
  }) {
    const response = await apiContext.patch(
      `/api/v1/tables/name/${this.entityResponseData?.['fullyQualifiedName']}`,
      {
        data: patchData,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    this.entityResponseData = await response.json();

    return {
      entity: this.entityResponseData,
    };
  }

  async followTable(apiContext: APIRequestContext, userId: string) {
    await apiContext.put(
      `/api/v1/tables/${this.entityResponseData?.['id']}/followers`,
      {
        data: userId,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  async delete(apiContext: APIRequestContext, hardDelete = true) {
    const serviceResponse = await apiContext.delete(
      `/api/v1/services/databaseServices/name/${encodeURIComponent(
        this.serviceResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=${hardDelete}`
    );

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
    };
  }

  async deleteTable(apiContext: APIRequestContext, hardDelete = true) {
    const tableResponse = await apiContext.delete(
      `/api/v1/tables/${this.entityResponseData?.['id']}?recursive=true&hardDelete=${hardDelete}`
    );

    return tableResponse;
  }

  async restore(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.put('/api/v1/tables/restore', {
      data: { id: this.entityResponseData?.['id'] },
    });

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
    };
  }
}
