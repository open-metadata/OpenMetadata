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
import {
  APIEndpoint,
  DataTypeTopic,
  Field,
} from '../../../src/generated/entity/data/apiEndpoint';
import { SERVICE_TYPE } from '../../constant/service';
import { ServiceTypes } from '../../constant/settings';
import {
  createOrFetch,
  okJson,
  withNotFoundRetry,
} from '../../utils/apiResponse';
import { uuid } from '../../utils/common';
import { visitEntityPageByFqn } from '../../utils/entity';
import type { ApiCollectionClass } from './ApiCollectionClass';
import { EntityTypeEndpoint, ResponseDataType } from './Entity.interface';
import { EntityClass } from './EntityClass';
import { resolveParents } from './ParentResolver';
import { ApiServiceClass } from './service/ApiServiceClass';

/**
 * Without a parent the endpoint sits in the shard's shared API service →
 * collection chain. Pass the deepest parent the test needs to own:
 *   - `service` — own service page, unique service name, or service-level
 *     cascade;
 *   - `collection` — mutates the collection or asserts on its endpoint
 *     listing.
 * Levels below the one passed are created fresh and deleted with the endpoint.
 */
export type ApiEndpointClassOptions = {
  name?: string;
  service?: ApiServiceClass;
  collection?: ApiCollectionClass;
  sharedInfraKey?: string;
};

export class ApiEndpointClass extends EntityClass {
  service: ApiServiceClass['entity'];

  apiCollection: {
    name: string;
    displayName: string;
    service: string;
  };

  private readonly fqn: string;

  children: Field[];

  entity: {
    name: string;
    displayName: string;
    description: string;
    apiCollection: string;
    endpointURL: string;
    requestSchema: {
      schemaType: string;
      schemaFields: Field[];
    };
    responseSchema: {
      schemaType: string;
      schemaFields: Field[];
    };
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  apiCollectionResponseData: APIEndpoint = {} as APIEndpoint;
  entityResponseData: APIEndpoint = {} as APIEndpoint;

  private readonly parentOverrides: Pick<
    ApiEndpointClassOptions,
    'service' | 'collection'
  >;

  constructor(options: ApiEndpointClassOptions = {}) {
    super(EntityTypeEndpoint.API_ENDPOINT);
    this.sharedInfraKey = options.sharedInfraKey;
    this.parentOverrides = {
      service: options.service,
      collection: options.collection,
    };

    // Placeholder parent names until create() binds the resolved chain.
    this.service = options.service?.entity ?? new ApiServiceClass().entity;
    const apiCollectionName = `pw-api-collection-${uuid()}`;
    this.apiCollection = {
      name: apiCollectionName,
      displayName: apiCollectionName,
      service: this.service.name,
    };

    const apiEndpointName = options.name ?? `pw-api-endpoint-${uuid()}`;
    this.fqn = `${this.service.name}.${this.apiCollection.name}.${apiEndpointName}.requestSchema`;

    this.children = [
      {
        name: 'default',
        dataType: DataTypeTopic.Record,
        fullyQualifiedName: `${this.fqn}.default`,
        tags: [],
        children: [
          {
            name: 'name',
            dataType: DataTypeTopic.Record,
            fullyQualifiedName: `${this.fqn}.default.name`,
            tags: [],
            children: [
              {
                name: 'first_name',
                dataType: DataTypeTopic.String,
                description: 'Description for schema field first_name',
                fullyQualifiedName: `${this.fqn}.default.name.first_name`,
                tags: [],
              },
              {
                name: 'last_name',
                dataType: DataTypeTopic.String,
                fullyQualifiedName: `${this.fqn}.default.name.last_name`,
                tags: [],
              },
            ],
          },
          {
            name: 'age',
            dataType: DataTypeTopic.Int,
            fullyQualifiedName: `${this.fqn}.default.age`,
            tags: [],
          },
          {
            name: 'club_name',
            dataType: DataTypeTopic.String,
            fullyQualifiedName: `${this.fqn}.default.club_name`,
            tags: [],
          },
        ],
      },
    ];

    this.entity = {
      name: apiEndpointName,
      displayName: apiEndpointName,
      apiCollection: `${this.service.name}.${this.apiCollection.name}`,
      endpointURL: 'https://sandbox-beta.open-metadata.org/swagger.json',
      description: `Description for ${apiEndpointName}`,
      requestSchema: {
        schemaType: 'JSON',
        schemaFields: this.children,
      },
      responseSchema: {
        schemaType: 'JSON',
        schemaFields: [
          {
            name: 'default',
            dataType: DataTypeTopic.Record,
            fullyQualifiedName: `${this.fqn}.default`,
            tags: [],
            children: [
              {
                name: 'name',
                dataType: DataTypeTopic.Record,
                fullyQualifiedName: `${this.fqn}.default.name`,
                tags: [],
                children: [
                  {
                    name: 'first_name',
                    dataType: DataTypeTopic.String,
                    fullyQualifiedName: `${this.fqn}.default.name.first_name`,
                    tags: [],
                  },
                  {
                    name: 'last_name',
                    dataType: DataTypeTopic.String,
                    fullyQualifiedName: `${this.fqn}.default.name.last_name`,
                    tags: [],
                  },
                ],
              },
              {
                name: 'age',
                dataType: DataTypeTopic.Int,
                fullyQualifiedName: `${this.fqn}.default.age`,
                tags: [],
              },
              {
                name: 'club_name',
                dataType: DataTypeTopic.String,
                fullyQualifiedName: `${this.fqn}.default.club_name`,
                tags: [],
              },
            ],
          },
        ],
      },
    };

    this.serviceCategory = SERVICE_TYPE.ApiService;
    this.serviceType = ServiceTypes.API_SERVICES;
    this.type = 'ApiEndpoint';
    this.exploreTabName = 'API Endpoints';
    this.childrenTabId = 'schema';
    this.childrenSelectorId = this.children[0].fullyQualifiedName ?? '';
  }

  async create(apiContext: APIRequestContext) {
    const { parents, ownedRootPath, ownedOverride } = await resolveParents(
      apiContext,
      'api',
      this.parentOverrides,
      this.sharedInfraKey
    );
    const service = parents.service as ResponseDataType;
    const collection = parents.collection as ResponseDataType;

    this.adoptOwnership({ ownedRootPath, ownedOverride });
    this.bindParentNames(service, collection);
    this.serviceResponseData = service;
    this.apiCollectionResponseData = collection as unknown as APIEndpoint;

    this.entityResponseData = await createOrFetch(apiContext, {
      label: 'ApiEndpointClass.create apiEndpoint',
      createPath: '/api/v1/apiEndpoints',
      fqnSegments: [
        this.service.name,
        this.apiCollection.name,
        this.entity.name,
      ],
      data: this.entity,
    });

    this.childrenSelectorId =
      this.entityResponseData.requestSchema?.schemaFields?.[0]
        .fullyQualifiedName ?? '';

    return {
      service: this.serviceResponseData,
      apiCollection: this.apiCollectionResponseData,
      entity: this.entityResponseData,
    };
  }

  private bindParentNames(
    service: ResponseDataType,
    collection: ResponseDataType
  ) {
    this.service = { ...this.service, name: service.name };
    this.apiCollection = {
      ...this.apiCollection,
      name: collection.name,
      service: service.name,
    };
    this.entity.apiCollection = collection.fullyQualifiedName;
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
        `/api/v1/apiEndpoints/name/${this.entityResponseData?.fullyQualifiedName}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );

    this.entityResponseData = await okJson(response, 'ApiEndpointClass.patch');

    return {
      entity: this.entityResponseData,
    };
  }

  get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
      apiCollection: this.apiCollectionResponseData,
      ownedRootPath: this.ownedRootPath,
    };
  }

  public set(data: {
    entity: APIEndpoint;
    service: ResponseDataType;
    apiCollection: APIEndpoint;
    ownedRootPath?: string;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.apiCollectionResponseData = data.apiCollection;
    this.ownedRootPath = data.ownedRootPath;
    this.entity.name = data.entity.name;
    this.bindParentNames(
      data.service,
      data.apiCollection as unknown as ResponseDataType
    );
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
      `/api/v1/apiEndpoints/${this.entityResponseData?.id}`
    );

    return { entity: this.entityResponseData };
  }
}
