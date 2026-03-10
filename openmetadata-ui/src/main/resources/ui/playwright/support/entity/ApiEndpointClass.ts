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
import { uuid } from '../../utils/common';
import { visitEntityPage } from '../../utils/entity';
import { EntityTypeEndpoint, ResponseDataType } from './Entity.interface';
import { EntityClass } from './EntityClass';

export class ApiEndpointClass extends EntityClass {
  private readonly serviceName: string;
  private readonly apiCollectionName: string;
  service: {
    name: string;
    displayName: string;
    serviceType: string;
    connection: {
      config: {
        type: string;
        openAPISchemaConnection: {
          openAPISchemaURL: string;
        };
      };
    };
  };

  apiCollection: {
    name: string;
    displayName: string;
    service: string;
  };

  private readonly apiEndpointName: string;
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

  constructor(name?: string, apiEndpointName?: string) {
    super(EntityTypeEndpoint.API_ENDPOINT);

    this.serviceName = name ?? `pw-api-service-${uuid()}`;
    this.apiCollectionName = `pw-api-collection-${uuid()}`;

    this.service = {
      name: this.serviceName,
      displayName: this.serviceName,
      serviceType: 'Rest',
      connection: {
        config: {
          type: 'Rest',
          openAPISchemaConnection: {
            openAPISchemaURL:
              'https://sandbox-beta.open-metadata.org/swagger.json',
          },
        },
      },
    };

    this.apiCollection = {
      name: this.apiCollectionName,
      displayName: this.apiCollectionName,
      service: this.service.name,
    };

    this.apiEndpointName = apiEndpointName ?? `pw-api-endpoint-${uuid()}`;
    this.fqn = `${this.service.name}.${this.apiCollection.name}.${this.apiEndpointName}.requestSchema`;

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
      name: this.apiEndpointName,
      displayName: this.apiEndpointName,
      apiCollection: `${this.service.name}.${this.apiCollection.name}`,
      endpointURL: 'https://sandbox-beta.open-metadata.org/swagger.json',
      description: `Description for ${this.apiEndpointName}`,
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
    this.childrenTabId = 'schema';
    this.childrenSelectorId = this.children[0].fullyQualifiedName ?? '';
  }

  async create(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/apiServices',
      {
        data: this.service,
      }
    );

    const apiCollectionResponse = await apiContext.post(
      '/api/v1/apiCollections',
      {
        data: this.apiCollection,
      }
    );

    const entityResponse = await apiContext.post('/api/v1/apiEndpoints', {
      data: this.entity,
    });

    this.serviceResponseData = await serviceResponse.json();
    this.apiCollectionResponseData = await apiCollectionResponse.json();
    this.entityResponseData = await entityResponse.json();

    this.childrenSelectorId =
      this.entityResponseData.requestSchema?.schemaFields?.[0]
        .fullyQualifiedName ?? '';

    return {
      service: serviceResponse.body,
      apiCollection: apiCollectionResponse.body,
      entity: entityResponse.body,
    };
  }

  async patch({
    apiContext,
    patchData,
  }: {
    apiContext: APIRequestContext;
    patchData: Operation[];
  }) {
    const response = await apiContext.patch(
      `/api/v1/apiEndpoints/name/${this.entityResponseData?.fullyQualifiedName}`,
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

  get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
      apiCollection: this.apiCollectionResponseData,
    };
  }

  public set(data: {
    entity: APIEndpoint;
    service: ResponseDataType;
    apiCollection: APIEndpoint;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.apiCollectionResponseData = data.apiCollection;
  }

  async visitEntityPage(page: Page) {
    await visitEntityPage({
      page,
      searchTerm: this.entityResponseData?.fullyQualifiedName ?? '',
      dataTestId: `${
        this.entityResponseData.service?.name ?? this.service.name
      }-${this.entityResponseData.name ?? this.entity.name}`,
    });
  }

  async delete(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.delete(
      `/api/v1/services/apiServices/name/${encodeURIComponent(
        this.serviceResponseData?.fullyQualifiedName ?? ''
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
      apiCollection: this.apiCollectionResponseData,
    };
  }
}
