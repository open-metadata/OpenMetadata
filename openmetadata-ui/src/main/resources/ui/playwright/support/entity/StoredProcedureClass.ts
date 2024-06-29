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
import { toLower } from 'lodash';
import { getEntityTypeSearchIndexMapping, uuid } from '../../utils/common';
import { checkDataAssetWidget, visitEntityPage } from '../../utils/entity';
import { EntityTypeEndpoint } from './Entity.interface';
import { EntityClass } from './EntityClass';

export class StoredProcedureClass extends EntityClass {
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
    name: `pw-stored-procedure-${uuid()}`,
    databaseSchema: `${this.service.name}.${this.database.name}.${this.schema.name}`,
    storedProcedureCode: {
      code: 'CREATE OR REPLACE PROCEDURE output_message(message VARCHAR)\nRETURNS VARCHAR NOT NULL\nLANGUAGE SQL\nAS\n$$\nBEGIN\n  RETURN message;\nEND;\n$$\n;',
    },
  };
  tableEntity = {
    name: `pw-table-${uuid()}`,
    description: 'description',
    databaseSchema: `${this.service.name}.${this.database.name}.${this.schema.name}`,
  };

  serviceResponseData: unknown;
  databaseResponseData: unknown;
  schemaResponseData: unknown;
  entityResponseData: unknown;
  tableResponseData: unknown;

  constructor(name?: string) {
    super(EntityTypeEndpoint.StoreProcedure);
    this.service.name = name ?? this.service.name;
    this.type = 'Store Procedure';
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
    const entityResponse = await apiContext.post('/api/v1/storedProcedures', {
      data: this.entity,
    });

    const tableResponse = await apiContext.post('/api/v1/tables', {
      data: this.tableEntity,
    });

    const service = await serviceResponse.json();
    const database = await databaseResponse.json();
    const schema = await schemaResponse.json();
    const entity = await entityResponse.json();
    const table = await tableResponse.json();

    this.serviceResponseData = service;
    this.databaseResponseData = database;
    this.schemaResponseData = schema;
    this.entityResponseData = entity;
    this.tableResponseData = table;

    return {
      service,
      database,
      schema,
      entity,
      table,
    };
  }

  get() {
    return {
      service: this.serviceResponseData,
      database: this.databaseResponseData,
      schema: this.schemaResponseData,
      entity: this.entityResponseData,
      table: this.tableResponseData,
    };
  }

  async visitEntityPage(page: Page) {
    await visitEntityPage({
      page,
      searchTerm: this.entityResponseData?.['fullyQualifiedName'],
      dataTestId: `${this.service.name}-${this.entity.name}`,
    });
  }

  async checkDataAssetWidget(page: Page) {
    await checkDataAssetWidget(
      page,
      'Tables',
      getEntityTypeSearchIndexMapping('Table'),
      toLower(this.service.serviceType)
    );
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
