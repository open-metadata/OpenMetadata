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
import { visitEntityPageByFqn } from '../../utils/entity';
import type { DatabaseClass } from './DatabaseClass';
import type { DatabaseSchemaClass } from './DatabaseSchemaClass';
import {
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
  ServiceEntity,
} from './Entity.interface';
import { EntityClass } from './EntityClass';
import { resolveParents } from './ParentResolver';
import { DatabaseServiceClass } from './service/DatabaseServiceClass';

/**
 * Without a parent the stored procedure sits in the shard's shared service →
 * database → schema chain. Pass the deepest parent the test needs to own:
 *   - `service` — own service page, unique service name, or service-level
 *     cascade;
 *   - `database` — mutates the database or asserts on its schema listing;
 *   - `schema` — asserts on the schema's stored-procedure listing.
 * Levels below the one passed are created fresh and deleted with the entity.
 */
export type StoredProcedureClassOptions = {
  name?: string;
  service?: DatabaseServiceClass;
  database?: DatabaseClass;
  schema?: DatabaseSchemaClass;
  sharedInfraKey?: string;
};

export class StoredProcedureClass extends EntityClass {
  service: ServiceEntity;
  database: {
    name: string;
    service: string;
  };
  schema: {
    name: string;
    database: string;
  };
  entity: {
    name: string;
    databaseSchema: string;
    description: string;
    storedProcedureCode: {
      code: string;
    };
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  databaseResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  schemaResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;

  private readonly parentOverrides: Pick<
    StoredProcedureClassOptions,
    'service' | 'database' | 'schema'
  >;

  constructor(options: StoredProcedureClassOptions = {}) {
    super(EntityTypeEndpoint.StoreProcedure);
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

    const name = options.name ?? `pw-stored-procedure-${uuid()}`;
    this.entity = {
      name,
      description: `Description for ${name}`,
      databaseSchema: `${this.service.name}.${this.database.name}.${this.schema.name}`,
      storedProcedureCode: {
        code: 'CREATE OR REPLACE PROCEDURE output_message(message VARCHAR)\nRETURNS VARCHAR NOT NULL\nLANGUAGE SQL\nAS\n$$\nBEGIN\n  RETURN message;\nEND;\n$$\n;',
      },
    };

    this.serviceCategory = SERVICE_TYPE.Database;
    this.type = 'Store Procedure';
    this.serviceType = ServiceTypes.DATABASE_SERVICES;
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

    const entity = await createOrFetch<ResponseDataWithServiceType>(
      apiContext,
      {
        label: 'StoredProcedureClass.create storedProcedure',
        createPath: '/api/v1/storedProcedures',
        fqnSegments: [
          service.name,
          database.name,
          schema.name,
          this.entity.name,
        ],
        data: this.entity,
      }
    );

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

  async patch({
    apiContext,
    patchData,
  }: {
    apiContext: APIRequestContext;
    patchData: Operation[];
  }) {
    const response = await withNotFoundRetry(() =>
      apiContext.patch(
        `/api/v1/storedProcedures/name/${this.entityResponseData?.['fullyQualifiedName']}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );
    this.entityResponseData = await okJson(
      response,
      'StoredProcedureClass.patch'
    );

    return {
      entity: this.entityResponseData,
    };
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

  public set(data: {
    entity: ResponseDataWithServiceType;
    service: ResponseDataType;
    database: ResponseDataWithServiceType;
    schema: ResponseDataWithServiceType;
    ownedRootPath?: string;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.databaseResponseData = data.database;
    this.schemaResponseData = data.schema;
    this.ownedRootPath = data.ownedRootPath;
    this.entity.name = data.entity.name;
    this.bindParentNames(data.service, data.database, data.schema);
  }

  async visitEntityPage(page: Page) {
    await visitEntityPageByFqn({
      page,
      endpoint: this.endpoint,
      fqn: this.entityResponseData?.fullyQualifiedName ?? '',
    });
  }

  async delete(apiContext: APIRequestContext) {
    await this.deleteOwnedOrLeaf(
      apiContext,
      `/api/v1/storedProcedures/${this.entityResponseData?.id}`
    );

    return { entity: this.entityResponseData };
  }
}
