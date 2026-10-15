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
import { ServiceTypes } from '../../constant/settings';
import {
  createOrFetch,
  okJson,
  withNotFoundRetry,
} from '../../utils/apiResponse';
import { uuid } from '../../utils/common';
import { visitEntityPageByFqn } from '../../utils/entity';
import type { DatabaseClass } from './DatabaseClass';
import {
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
} from './Entity.interface';
import { EntityClass } from './EntityClass';
import type { ParentNode, ParentSnapshot } from './ParentChain';
import { parentDeletePath } from './ParentChain';
import { resolveParents } from './ParentResolver';
import { DatabaseServiceClass } from './service/DatabaseServiceClass';

/**
 * Without a parent the schema sits in the shard's shared service → database.
 * Pass the deepest parent the test must own: `database` when it mutates or
 * lists the database, `service` when it touches the service itself.
 */
export type DatabaseSchemaClassOptions = {
  name?: string;
  service?: DatabaseServiceClass;
  database?: DatabaseClass;
  sharedInfraKey?: string;
};

export class DatabaseSchemaClass extends EntityClass implements ParentNode {
  readonly parentLevel = 'schema' as const;
  private readonly parentOverrides: Pick<
    DatabaseSchemaClassOptions,
    'service' | 'database'
  >;
  service = new DatabaseServiceClass().entity;
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

  constructor(options: DatabaseSchemaClassOptions = {}) {
    super(EntityTypeEndpoint.DatabaseSchema);
    this.type = 'Database Schema';
    this.serviceType = ServiceTypes.DATABASE_SERVICES;
    this.sharedInfraKey = options.sharedInfraKey;
    this.parentOverrides = {
      service: options.service,
      database: options.database,
    };
    if (options.name) {
      this.entity.name = options.name;
    }
  }

  private bindParentNames(serviceName: string, databaseName: string) {
    this.service = { ...this.service, name: serviceName };
    this.database = { name: databaseName, service: serviceName };
    this.entity.database = `${serviceName}.${databaseName}`;
  }

  async create(apiContext: APIRequestContext) {
    const { parents, ownedRootPath, ownedOverride } = await resolveParents(
      apiContext,
      'database',
      this.parentOverrides,
      this.sharedInfraKey,
      'database'
    );
    const service = parents.service as ResponseDataType;
    const database = {
      ...parents.database,
      service,
    } as ResponseDataWithServiceType;
    this.adoptOwnership({ ownedRootPath, ownedOverride });
    this.bindParentNames(service.name, database.name);

    const entity = await createOrFetch(apiContext, {
      label: 'DatabaseSchemaClass.create schema',
      createPath: '/api/v1/databaseSchemas',
      fqnSegments: [service.name, database.name, this.entity.name],
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
      ownedRootPath: this.ownedRootPath,
    };
  }

  public set(data: {
    entity: ResponseDataWithServiceType;
    service: ResponseDataType;
    database: ResponseDataWithServiceType;
    ownedRootPath?: string;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.databaseResponseData = data.database;
    this.ownedRootPath = data.ownedRootPath;
    this.entity.name = data.entity.name;
    this.bindParentNames(data.service.name, data.database.name);
  }

  isCreated() {
    return Boolean(this.entityResponseData?.id);
  }

  forget() {
    this.entityResponseData = {} as typeof this.entityResponseData;
    this.forgetOwnership();
  }

  parentSnapshot(): ParentSnapshot {
    return {
      service: this.serviceResponseData,
      database: this.databaseResponseData,
      schema: this.entityResponseData,
    };
  }

  rootDeletePath() {
    return this.ownedRootPath ?? this.schemaPath();
  }

  private schemaPath() {
    return parentDeletePath(
      'databaseSchemas',
      this.entityResponseData?.fullyQualifiedName ?? ''
    );
  }

  // FQN navigation: a shared service/database paginates its children, so
  // clicking through them can miss this schema.
  async visitEntityPage(page: Page) {
    await visitEntityPageByFqn({
      page,
      endpoint: EntityTypeEndpoint.DatabaseSchema,
      fqn: this.entityResponseData?.fullyQualifiedName ?? '',
    });
  }

  async delete(apiContext: APIRequestContext) {
    await this.deleteOwnedOrLeaf(apiContext, this.schemaPath());

    return { entity: this.entityResponseData };
  }
}
