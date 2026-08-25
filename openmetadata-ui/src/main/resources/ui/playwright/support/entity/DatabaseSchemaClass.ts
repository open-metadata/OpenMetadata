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
import {
  createOrFetch,
  okJson,
  withNotFoundRetry,
} from '../../utils/apiResponse';
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
  entity = {
    name: `pw-database-schema-${uuid()}`,
    database: `${this.service.name}.${this.database.name}`,
    description: 'description',
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
    const service = await createOrFetch(apiContext, {
      label: 'DatabaseSchemaClass.create service',
      createPath: '/api/v1/services/databaseServices',
      fqnSegments: [this.service.name],
      data: this.service,
    });
    const database = await createOrFetch(apiContext, {
      label: 'DatabaseSchemaClass.create database',
      createPath: '/api/v1/databases',
      fqnSegments: [this.service.name, this.database.name],
      data: this.database,
    });
    const entity = await createOrFetch(apiContext, {
      label: 'DatabaseSchemaClass.create schema',
      createPath: '/api/v1/databaseSchemas',
      fqnSegments: [this.service.name, this.database.name, this.entity.name],
      data: this.entity,
    });

    this.serviceResponseData = service;
    this.databaseResponseData = database;
    this.entityResponseData = entity;

    return {
      service,
      database,
      entity,
    };
  }

  async patch({
    apiContext,
    patchData,
  }: {
    apiContext: APIRequestContext;
    patchData: Operation[];
  }) {
    const serviceResponse = await withNotFoundRetry(() =>
      apiContext.patch(
        `/api/v1/databaseSchemas/${this.entityResponseData?.['id']}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );

    const entity = await okJson(serviceResponse, 'DatabaseSchemaClass.patch');

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

  public set(data: {
    entity: ResponseDataWithServiceType;
    service: ResponseDataType;
    database: ResponseDataWithServiceType;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.databaseResponseData = data.database;
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

    // Wait for the database to be visible before clicking
    await page.getByTestId(this.database.name).waitFor({ state: 'visible' });

    const databaseResponse = page.waitForResponse(
      `/api/v1/databases/name/*${this.database.name}?**`
    );
    await page.getByTestId(this.database.name).click();
    await databaseResponse;

    // Wait for page to fully load after navigation

    // Target schema specifically within the table container to avoid clicking breadcrumbs or other elements
    const schemaLocator = page.getByTestId(this.entity.name);

    await schemaLocator.waitFor({ state: 'visible' });

    const databaseSchemaResponse = page.waitForResponse(
      `/api/v1/databaseSchemas/name/*${this.entity.name}?*`
    );
    await schemaLocator.click();
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
