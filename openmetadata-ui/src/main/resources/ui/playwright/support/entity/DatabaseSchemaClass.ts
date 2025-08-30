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
import { SERVICE_TYPE } from '../../constant/service';
import { ServiceTypes } from '../../constant/settings';
import { uuid } from '../../utils/common';
import { visitServiceDetailsPage } from '../../utils/service';
import {
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
} from './Entity.interface';
import { EntityClass } from './EntityClass';

export class DatabaseSchemaClass extends EntityClass {
  service = {
    name: `pw.database%service-${uuid()}`,
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
    name: `pw.database%${uuid()}`,
    service: this.service.name,
  };
  entity = {
    name: `pw.database%schema-${uuid()}`,
    database: `${this.service.name}.${this.database.name}`,
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  databaseResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;

  constructor(name?: string) {
    super(EntityTypeEndpoint.DatabaseSchema);
    this.service.name = name ?? this.service.name;
    this.type = 'Database Schema';
    this.serviceType = ServiceTypes.DATABASE_SERVICES;
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
    const entityResponse = await apiContext.post('/api/v1/databaseSchemas', {
      data: this.entity,
    });

    const service = await serviceResponse.json();
    const database = await databaseResponse.json();
    const entity = await entityResponse.json();

    this.serviceResponseData = service;
    this.databaseResponseData = database;
    this.entityResponseData = entity;

    return {
      service,
      database,
      entity,
    };
  }

  async patch(apiContext: APIRequestContext, payload: Operation[]) {
    const serviceResponse = await apiContext.patch(
      `/api/v1/databaseSchemas/${this.entityResponseData?.['id']}`,
      {
        data: payload,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    const entity = await serviceResponse.json();

    this.entityResponseData = entity;

    return entity;
  }

  get() {
    return {
      service: this.serviceResponseData,
      database: this.databaseResponseData,
      entity: this.entityResponseData,
    };
  }

  async visitEntityPage(page: Page) {
    await visitServiceDetailsPage(
      page,
      {
        name: this.service.name,
        type: SERVICE_TYPE.Database,
      },
      false
    );

    const databaseResponse = page.waitForResponse(
      `/api/v1/databases/name/*${this.database.name}?**`
    );
    await page.getByTestId(this.database.name).click();
    await databaseResponse;
    const databaseSchemaResponse = page.waitForResponse(
      `/api/v1/databaseSchemas/name/*${this.entity}?*`
    );
    await page.getByTestId(this.entity.name).click();
    await databaseSchemaResponse;
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
