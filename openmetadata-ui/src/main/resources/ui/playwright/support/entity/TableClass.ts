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
import {
  AssetCertification,
  Column,
  DataType,
  Table,
} from '../../../src/generated/entity/data/table';
import { SERVICE_TYPE } from '../../constant/service';
import { ServiceTypes } from '../../constant/settings';
import {
  createOrFetch,
  deleteFixtureEntity,
  okJson,
  withNotFoundRetry,
} from '../../utils/apiResponse';
import { fullUuid, uuid } from '../../utils/common';
import { visitEntityPage, visitEntityPageByFqn } from '../../utils/entity';
import type { DatabaseClass } from './DatabaseClass';
import type { DatabaseSchemaClass } from './DatabaseSchemaClass';
import {
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
  ServiceEntity,
  TestCaseData,
  TestSuiteData,
} from './Entity.interface';
import { EntityClass } from './EntityClass';
import { resolveParents } from './ParentResolver';
import { DatabaseServiceClass } from './service/DatabaseServiceClass';

/**
 * Without a parent the table sits in the shard's shared service → database →
 * schema chain. Pass the deepest parent the test needs to own:
 *   - `service` — own service page, unique service name, service-level
 *     cascade, or a non-Mysql connector config
 *     (`new DatabaseServiceClass(name, config)`);
 *   - `database` — mutates the database (owners, domain) or asserts on its
 *     schema listing;
 *   - `schema` — asserts on the schema's table listing.
 * Levels below the one passed are created fresh and deleted with the table.
 */
export type TableClassOptions = {
  name?: string;
  tableType?: string;
  service?: DatabaseServiceClass;
  database?: DatabaseClass;
  schema?: DatabaseSchemaClass;
  sharedInfraKey?: string;
};

export class TableClass extends EntityClass {
  service: ServiceEntity;
  database: { name: string; service: string };
  schema: { name: string; database: string };
  columnsName: string[];
  entityLinkColumnsName: string[];
  children: Column[];
  entity: {
    name: string;
    displayName: string;
    description: string;
    columns: Column[];
    tableType: string;
    databaseSchema: string;
    certification?: AssetCertification;
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  databaseResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  schemaResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  entityResponseData: Table = {} as Table;
  testSuiteResponseData: ResponseDataType = {} as ResponseDataType;
  testSuitePipelineResponseData: ResponseDataType[] = [];
  testCasesResponseData: ResponseDataType[] = [];
  queryResponseData: ResponseDataType[] = [];
  additionalEntityTableResponseData: ResponseDataType[] = [];

  private readonly parentOverrides: Pick<
    TableClassOptions,
    'service' | 'database' | 'schema'
  >;

  constructor(options: TableClassOptions = {}) {
    super(EntityTypeEndpoint.Table);
    this.serviceCategory = SERVICE_TYPE.Database;
    this.serviceType = ServiceTypes.DATABASE_SERVICES;
    this.type = 'Table';
    this.childrenTabId = 'schema';
    this.sharedInfraKey = options.sharedInfraKey;
    this.parentOverrides = {
      service: options.service,
      database: options.database,
      schema: options.schema,
    };

    // Placeholder parent names until create() binds the resolved chain.
    this.service = options.service?.entity ?? new DatabaseServiceClass().entity;
    this.database = {
      name: `pw-database-${uuid()}`,
      service: this.service.name,
    };
    this.schema = {
      name: `pw-database-schema-${uuid()}`,
      database: `${this.service.name}.${this.database.name}`,
    };

    this.columnsName = [
      `user_id${uuid()}`,
      `shop_id${uuid()}`,
      `name${uuid()}`,
      `first_name${uuid()}`,
      `last_name${uuid()}`,
      `address${uuid()}`,
      `mail${uuid()}`,
      `email${uuid()}`,
      `created_at${uuid()}`,
    ];

    this.entityLinkColumnsName = [
      this.columnsName[0],
      this.columnsName[1],
      this.columnsName[2],
      `${this.columnsName[2]}.${this.columnsName[3]}`,
      `${this.columnsName[2]}.${this.columnsName[4]}`,
      `${this.columnsName[2]}.${this.columnsName[4]}.${this.columnsName[5]}`,
      `${this.columnsName[2]}.${this.columnsName[4]}.${this.columnsName[6]}`,
      this.columnsName[7],
      this.columnsName[8],
    ];

    this.children = [
      {
        name: this.columnsName[0],
        dataType: DataType.Numeric,
        dataTypeDisplay: 'numeric',
        description:
          'Unique identifier for the user of your Shopify POS or your Shopify admin.',
      },
      {
        name: this.columnsName[1],
        dataType: DataType.Int,
        dataTypeDisplay: 'int',
        description:
          'The ID of the store. This column is a foreign key reference to the shop_id column in the dim.shop table.',
      },
      {
        name: this.columnsName[2],
        dataType: DataType.Varchar,
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Name of the staff member.',
        children: [
          {
            name: this.columnsName[3],
            dataType: DataType.Struct,
            dataLength: 100,
            dataTypeDisplay:
              'struct<username:varchar(32),name:varchar(32),sex:char(1),address:varchar(128),mail:varchar(64),birthdate:varchar(16)>',
            description: 'First name of the staff member.',
          },
          {
            name: this.columnsName[4],
            dataType: DataType.Array,
            dataLength: 100,
            dataTypeDisplay: 'array<struct<type:string,provider:array<int>>>',
            children: [
              {
                name: this.columnsName[5],
                dataType: DataType.Struct,
                dataLength: 100,
                dataTypeDisplay:
                  'struct<username:varchar(32),name:varchar(32),sex:char(1),address:varchar(128),mail:varchar(64),birthdate:varchar(16)>',
                description: 'First name of the staff member.',
              },
              {
                name: this.columnsName[6],
                dataType: DataType.Array,
                dataLength: 100,
                dataTypeDisplay:
                  'array<struct<type:string,provider:array<int>>>',
              },
            ],
          },
        ],
      },
      {
        name: this.columnsName[7],
        dataType: DataType.Varchar,
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Email address of the staff member.',
      },
      {
        name: this.columnsName[8],
        dataType: DataType.Timestamp,
        dataLength: 100,
        dataTypeDisplay: 'timestamp',
        description: 'entity created time',
      },
    ];

    this.entity = {
      name: options.name ?? `pw-table-${fullUuid()}`,
      displayName: `pw table ${fullUuid()}`,
      description: 'description',
      columns: this.children,
      tableType: options.tableType ?? 'SecureView',
      databaseSchema: `${this.service.name}.${this.database.name}.${this.schema.name}`,
    };

    this.childrenSelectorId = `${this.entity.databaseSchema}.${this.entity.name}.${this.children[0]['name']}`;
  }

  async create(apiContext: APIRequestContext) {
    const { parents, ownedRootPath, ownedOverride } = await resolveParents(
      apiContext,
      'database',
      this.parentOverrides,
      this.sharedInfraKey
    );
    const service = parents.service as ResponseDataType;
    const database = {
      ...parents.database,
      service,
    } as ResponseDataWithServiceType;
    const schema = {
      ...parents.schema,
      service,
    } as ResponseDataWithServiceType;

    this.adoptOwnership({ ownedRootPath, ownedOverride });
    this.bindParentNames(service, database, schema);

    // Relationship fields on the 409 lookup: a bare fetch reports
    // `domains: null` on an entity that already has one, and a caller that
    // re-applies `add /domains/0` is then rejected with "Multiple Domains".
    const entity = await createOrFetch<Table>(apiContext, {
      label: 'TableClass.create',
      createPath: '/api/v1/tables',
      fqnSegments: [service.name, database.name, schema.name, this.entity.name],
      data: this.entity,
      fields: 'domains,owners,tags',
    });

    this.serviceResponseData = service;
    this.databaseResponseData = database;
    this.schemaResponseData = schema;
    this.entityResponseData = entity;

    this.childrenSelectorId =
      this.entityResponseData.columns?.[0].fullyQualifiedName ?? '';

    return {
      service,
      database,
      schema,
      entity,
    };
  }

  private bindParentNames(
    service: ResponseDataType,
    database: ResponseDataType,
    schema: ResponseDataType
  ) {
    this.service = { ...this.service, name: service.name };
    this.database = { name: database.name, service: service.name };
    this.schema = {
      name: schema.name,
      database: `${service.name}.${database.name}`,
    };
    this.entity.databaseSchema = schema.fullyQualifiedName;
  }

  async createAdditionalTable(
    tableData: {
      name: string;
      displayName: string;
      description?: string;
      columns?: Column[];
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
    const entity = await okJson(
      entityResponse,
      'TableClass.createAdditionalTable'
    );
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
      ownedRootPath: this.ownedRootPath,
    };
  }

  set(entityData: {
    entity: Table;
    service: ResponseDataType;
    database: ResponseDataWithServiceType;
    schema: ResponseDataWithServiceType;
    ownedRootPath?: string;
  }) {
    this.serviceResponseData = entityData.service;
    this.databaseResponseData = entityData.database;
    this.schemaResponseData = entityData.schema;
    this.entityResponseData = entityData.entity;
    this.ownedRootPath = entityData.ownedRootPath;
    this.entity.name = entityData.entity.name;
    this.bindParentNames(
      entityData.service,
      entityData.database,
      entityData.schema
    );
  }

  async visitEntityPage(page: Page, searchTerm?: string) {
    if (!this.entityResponseData.fullyQualifiedName) {
      const { EntityDataClass } = await import('./EntityDataClass');
      EntityDataClass.loadResponseData();
    }

    if (
      !this.entityResponseData.fullyQualifiedName &&
      this.entityResponseData.id
    ) {
      const response = await page.request.get(
        `/api/v1/tables/${this.entityResponseData.id}`
      );

      if (response.ok()) {
        this.entityResponseData = await response.json();
      }
    }

    const tableFqn = this.entityResponseData.fullyQualifiedName ?? '';
    const canUseDirectNavigation =
      !searchTerm || (tableFqn.length > 0 && searchTerm === tableFqn);

    if (canUseDirectNavigation && tableFqn.length > 0) {
      await visitEntityPageByFqn({
        page,
        endpoint: EntityTypeEndpoint.Table,
        fqn: tableFqn,
      });

      return;
    }

    await visitEntityPage({
      page,
      searchTerm: searchTerm ?? tableFqn,
      dataTestId: `${
        this.entityResponseData.service?.name ?? this.service.name
      }-${this.entityResponseData.name ?? this.entity.name}`,
    });
  }

  async createQuery(apiContext: APIRequestContext, queryText?: string) {
    const queryResponse = await apiContext.post('/api/v1/queries', {
      data: {
        query:
          queryText ??
          `select * from ${this.entityResponseData?.fullyQualifiedName}`,
        queryUsedIn: [{ id: this.entityResponseData?.id, type: 'table' }],
        queryDate: Date.now(),
        service: this.serviceResponseData?.name,
      },
    });

    const query = await okJson(queryResponse, 'TableClass.createQuery');

    this.queryResponseData.push(query);

    return query;
  }

  async createTestSuiteAndPipelines(
    apiContext: APIRequestContext,
    testSuite?: TestSuiteData,
    scheduleInterval?: string | null
  ) {
    if (isEmpty(this.entityResponseData)) {
      await this.create(apiContext);
    }

    const testSuiteData = await apiContext
      .post('/api/v1/dataQuality/testSuites/basic', {
        data: {
          name: `pw-test-suite-${uuid()}`,
          basicEntityReference: this.entityResponseData?.fullyQualifiedName,
          description: 'Playwright test suite for table',
          ...testSuite,
        },
      })
      .then((res) => res.json());

    this.testSuiteResponseData = testSuiteData;

    const pipeline = await this.createTestSuitePipeline(
      apiContext,
      undefined,
      scheduleInterval
    );

    return {
      testSuiteData,
      pipeline,
    };
  }

  async createTestSuitePipeline(
    apiContext: APIRequestContext,
    testCases?: string[],
    scheduleInterval: string | null = '0 * * * *'
  ) {
    const pipelineData = await apiContext
      .post(`/api/v1/services/ingestionPipelines`, {
        data: {
          airflowConfig: scheduleInterval === null ? {} : { scheduleInterval },
          name: `pw-test-suite-pipeline-${uuid()}`,
          loggerLevel: 'INFO',
          pipelineType: 'TestSuite',
          service: {
            id: this.testSuiteResponseData?.id,
            type: 'testSuite',
          },
          sourceConfig: {
            config: {
              type: 'TestSuite',
              entityFullyQualifiedName:
                this.entityResponseData?.fullyQualifiedName,
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
    if (isEmpty(this.entityResponseData)) {
      await this.create(apiContext);
    }

    // Checked, not bare .json(): a failed create used to be pushed onto
    // testCasesResponseData as an error body, so callers read `undefined` for
    // the name and failed much later somewhere unrelated -- a search that waits
    // for `q === undefined` simply never resolves.
    const testCase = await okJson<
      ResponseDataType & { testSuite?: ResponseDataType }
    >(
      await apiContext.post('/api/v1/dataQuality/testCases', {
        data: {
          name: `pw_test_case_${uuid()}`,
          entityLink: `<#E::table::${this.entityResponseData?.fullyQualifiedName}>`,
          testDefinition: 'tableRowCountToBeBetween',
          parameterValues: [
            { name: 'minValue', value: 12 },
            { name: 'maxValue', value: 34 },
          ],
          ...testCaseData,
        },
      }),
      'TableClass.createTestCase'
    );

    // okJson guarantees testCase now, so only the optional testSuite needs a
    // guard -- assigning undefined here used to be masked by the untyped read.
    if (isEmpty(this.testSuiteResponseData) && testCase.testSuite) {
      this.testSuiteResponseData = testCase.testSuite;
    }

    this.testCasesResponseData.push(testCase);

    return testCase;
  }

  async addTestCaseResult(
    apiContext: APIRequestContext,
    testCaseFqn: string,
    testCaseResult: unknown
  ) {
    const testCaseResultResponse = await apiContext.post(
      `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
        testCaseFqn
      )}`,
      { data: testCaseResult }
    );

    return await okJson(testCaseResultResponse, 'TableClass.addTestCaseResult');
  }

  async patch({
    apiContext,
    patchData,
    queryParams,
  }: {
    apiContext: APIRequestContext;
    patchData: Operation[];
    queryParams?: Record<string, string>;
  }) {
    if (
      !this.entityResponseData?.fullyQualifiedName &&
      this.entityResponseData?.id
    ) {
      const tableResponse = await apiContext.get(
        `/api/v1/tables/${this.entityResponseData.id}`
      );

      if (tableResponse.ok()) {
        this.entityResponseData = await tableResponse.json();
      }
    }

    const tableId = this.entityResponseData?.id;
    const tableFqn = this.entityResponseData?.fullyQualifiedName;

    if (!tableId && !tableFqn) {
      throw new Error(
        `TableClass.patch: table id and fullyQualifiedName are missing for table "${
          this.entityResponseData?.name ?? this.entity.name
        }"`
      );
    }

    const queryString = queryParams
      ? `?${new URLSearchParams(queryParams).toString()}`
      : '';

    const response = await withNotFoundRetry(() =>
      apiContext.patch(
        tableId
          ? `/api/v1/tables/${tableId}${queryString}`
          : `/api/v1/tables/name/${encodeURIComponent(
              tableFqn!
            )}${queryString}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );

    this.entityResponseData = await okJson(response, 'TableClass.patch');

    return {
      entity: this.entityResponseData,
    };
  }

  async followTable(apiContext: APIRequestContext, userId: string) {
    await apiContext.put(
      `/api/v1/tables/${this.entityResponseData?.id}/followers`,
      {
        data: userId,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  async delete(apiContext: APIRequestContext, hardDelete = true) {
    await this.deleteOwnedOrLeaf(
      apiContext,
      `/api/v1/tables/${this.entityResponseData?.id}`,
      hardDelete
    );

    return { entity: this.entityResponseData };
  }

  async deleteTable(apiContext: APIRequestContext, hardDelete = true) {
    const tableResponse = await deleteFixtureEntity(
      apiContext,
      `/api/v1/tables/${this.entityResponseData?.id}?recursive=true&hardDelete=${hardDelete}`
    );

    return tableResponse;
  }

  async restore(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.put('/api/v1/tables/restore', {
      data: { id: this.entityResponseData?.id },
    });

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
    };
  }

  async setOwner(
    apiContext: APIRequestContext,
    owner: { id: string; type: 'user' | 'team' }
  ) {
    return this.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/owners',
          value: [owner],
        },
      ],
    });
  }
}
