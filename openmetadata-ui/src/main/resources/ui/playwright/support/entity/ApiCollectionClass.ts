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
import { redirectToHomePage, uuid } from '../../utils/common';
import { visitEntityPage, visitEntityPageByFqn } from '../../utils/entity';
import {
  EntityReference,
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
} from './Entity.interface';
import { EntityClass } from './EntityClass';
import type { ParentNode, ParentSnapshot } from './ParentChain';
import { parentDeletePath } from './ParentChain';
import { resolveParents } from './ParentResolver';
import { ApiServiceClass } from './service/ApiServiceClass';

export interface APIEndpointType extends ResponseDataType {
  responseSchema?: {
    schemaFields: EntityReference[];
  };
  requestSchema?: {
    schemaFields: EntityReference[];
  };
}

/**
 * Without `service` the collection sits in the shard's shared API service.
 * Pass an ApiServiceClass when the test visits, mutates or asserts on the
 * service itself.
 */
export type ApiCollectionClassOptions = {
  name?: string;
  service?: ApiServiceClass;
  sharedInfraKey?: string;
};

export class ApiCollectionClass extends EntityClass implements ParentNode {
  readonly parentLevel = 'collection' as const;
  private readonly serviceOverride?: ApiServiceClass;
  service: ApiServiceClass['entity'];
  entity: {
    name: string;
    service: string;
    description: string;
  };
  apiEndpoint: {
    name: string;
    apiCollection: string;
    endpointURL: string;
    requestSchema: unknown;
    responseSchema: unknown;
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  apiEndpointResponseData: APIEndpointType = {} as APIEndpointType;

  constructor(options: ApiCollectionClassOptions = {}) {
    super(EntityTypeEndpoint.API_COLLECTION);
    this.serviceCategory = SERVICE_TYPE.ApiService;
    this.serviceType = ServiceTypes.API_SERVICES;
    this.type = 'Api Collection';
    this.serviceOverride = options.service;
    this.sharedInfraKey = options.sharedInfraKey;
    this.service = options.service?.entity ?? new ApiServiceClass().entity;

    const name = options.name ?? `pw-api-collection-${uuid()}`;
    this.entity = {
      name,
      service: this.service.name,
      description: `Description for ${name}`,
    };

    this.apiEndpoint = {
      name: `pw-api-endpoint-${uuid()}`,
      apiCollection: `${this.service.name}.${this.entity.name}`,
      endpointURL: 'https://sandbox-beta.open-metadata.org/swagger.json',
      requestSchema: {
        schemaType: 'JSON',
        schemaFields: [
          {
            name: `default${uuid()}`,
            dataType: 'RECORD',
            tags: [],
            children: [
              {
                name: `name${uuid()}`,
                dataType: 'RECORD',
                tags: [],
                children: [
                  {
                    name: `first_name${uuid()}`,
                    dataType: 'STRING',
                    description: 'Description for schema field first_name',
                    tags: [],
                  },
                  {
                    name: `last_name${uuid()}`,
                    dataType: 'STRING',
                    tags: [],
                  },
                ],
              },
              {
                name: `age${uuid()}`,
                dataType: 'INT',
                tags: [],
              },
              {
                name: `club_name${uuid()}`,
                dataType: 'STRING',
                tags: [],
              },
            ],
          },
          {
            name: `secondary${uuid()}`,
            dataType: 'RECORD',
            tags: [],
          },
        ],
      },
      responseSchema: {
        schemaType: 'JSON',
        schemaFields: [
          {
            name: `default${uuid()}`,
            dataType: 'RECORD',
            tags: [],
            children: [
              {
                name: `name${uuid()}`,
                dataType: 'RECORD',
                tags: [],
                children: [
                  {
                    name: `first_name${uuid()}`,
                    dataType: 'STRING',
                    tags: [],
                  },
                  {
                    name: `last_name${uuid()}`,
                    dataType: 'STRING',
                    tags: [],
                  },
                ],
              },
              {
                name: `age${uuid()}`,
                dataType: 'INT',
                tags: [],
              },
              {
                name: `club_name${uuid()}`,
                dataType: 'STRING',
                tags: [],
              },
            ],
          },
          {
            name: `secondary${uuid()}`,
            dataType: 'RECORD',
            tags: [],
          },
        ],
      },
    };
  }

  private bindServiceName(serviceName: string) {
    this.service = { ...this.service, name: serviceName };
    this.entity.service = serviceName;
    this.apiEndpoint.apiCollection = `${serviceName}.${this.entity.name}`;
  }

  /**
   * Creates the collection alone. As a test's parent override it must not
   * seed its fixture endpoint: the caller's endpoint is the only child.
   */
  async createAsParent(apiContext: APIRequestContext) {
    const { parents, ownedRootPath, ownedOverride } = await resolveParents(
      apiContext,
      'api',
      { service: this.serviceOverride },
      this.sharedInfraKey,
      'service'
    );
    const service = parents.service as ResponseDataType;
    this.adoptOwnership({ ownedRootPath, ownedOverride });
    this.bindServiceName(service.name);

    const entity = await createOrFetch(apiContext, {
      label: 'ApiCollectionClass.create collection',
      createPath: '/api/v1/apiCollections',
      fqnSegments: [this.service.name, this.entity.name],
      data: this.entity,
    });
    this.serviceResponseData = service;
    this.entityResponseData = entity;

    return { service, entity };
  }

  async create(apiContext: APIRequestContext) {
    const { service, entity } = await this.createAsParent(apiContext);
    const apiEndpoint = await createOrFetch(apiContext, {
      label: 'ApiCollectionClass.create endpoint',
      createPath: '/api/v1/apiEndpoints',
      fqnSegments: [this.service.name, this.entity.name, this.apiEndpoint.name],
      data: this.apiEndpoint,
    });

    this.apiEndpointResponseData = apiEndpoint;

    return {
      service,
      entity,
      apiEndpoint,
    };
  }

  async patch(apiContext: APIRequestContext, payload: Operation[]) {
    const apiCollectionResponse = await withNotFoundRetry(() =>
      apiContext.patch(
        `/api/v1/apiCollections/name/${this.entityResponseData?.['fullyQualifiedName']}`,
        {
          data: payload,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );
    const apiCollection = await okJson(
      apiCollectionResponse,
      'ApiCollectionClass.patch'
    );

    this.entityResponseData = apiCollection;

    return apiCollection;
  }

  get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
      apiEndpoint: this.apiEndpointResponseData,
      ownedRootPath: this.ownedRootPath,
    };
  }

  public set(data: {
    entity: ResponseDataWithServiceType;
    service: ResponseDataType;
    apiEndpoint: APIEndpointType;
    ownedRootPath?: string;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.apiEndpointResponseData = data.apiEndpoint;
    this.ownedRootPath = data.ownedRootPath;
    this.entity.name = data.entity.name;
    this.apiEndpoint.name = data.apiEndpoint.name;
    this.bindServiceName(data.service.name);
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
      collection: this.entityResponseData,
    };
  }

  rootDeletePath() {
    return this.ownedRootPath ?? this.collectionPath();
  }

  private collectionPath() {
    return parentDeletePath(
      'apiCollections',
      this.entityResponseData?.fullyQualifiedName ?? ''
    );
  }

  // FQN navigation: the shared service page paginates its collections, so
  // clicking through it can miss this one.
  async visitEntityPage(page: Page) {
    await visitEntityPageByFqn({
      page,
      endpoint: EntityTypeEndpoint.API_COLLECTION,
      fqn: this.entityResponseData?.fullyQualifiedName ?? '',
    });
  }

  async delete(apiContext: APIRequestContext) {
    await this.deleteOwnedOrLeaf(apiContext, this.collectionPath());

    return { entity: this.entityResponseData };
  }

  async verifyOwnerPropagation(page: Page, owner: string) {
    await redirectToHomePage(page);
    await visitEntityPage({
      page,
      searchTerm: this.apiEndpointResponseData?.['fullyQualifiedName'],
      dataTestId: `${this.service.name}-${this.apiEndpoint.name}`,
    });
    await page.getByRole('link', { name: owner }).isVisible();
    await this.visitEntityPage(page);
  }
}
