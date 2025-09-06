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
import { redirectToHomePage, uuid } from '../../utils/common';
import { visitEntityPage } from '../../utils/entity';
import { visitServiceDetailsPage } from '../../utils/service';
import {
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
} from './Entity.interface';
import { EntityClass } from './EntityClass';

export class ApiCollectionClass extends EntityClass {
  private serviceName = `pw.api%service-${uuid()}`;
  private apiCollectionName = `pw.api%collection-${uuid()}`;
  service = {
    name: this.serviceName,
    serviceType: 'Rest',
    connection: {
      config: {
        type: 'Rest',
        openAPISchemaURL: 'https://sandbox-beta.open-metadata.org/swagger.json',
      },
    },
  };

  entity = {
    name: this.apiCollectionName,
    service: this.service.name,
  };

  private apiEndpointName = `pw.api%endpoint-${uuid()}`;

  apiEndpoint = {
    name: this.apiEndpointName,
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

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  apiEndpointResponseData: ResponseDataType = {} as ResponseDataType;

  constructor(name?: string) {
    super(EntityTypeEndpoint.API_COLLECTION);
    this.serviceCategory = SERVICE_TYPE.ApiService;
    this.serviceType = ServiceTypes.API_SERVICES;
    this.service.name = name ?? this.service.name;
    this.type = 'Api Collection';
  }

  async create(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/apiServices',
      {
        data: this.service,
      }
    );
    const entityResponse = await apiContext.post('/api/v1/apiCollections', {
      data: this.entity,
    });

    const apiEndpointResponse = await apiContext.post('/api/v1/apiEndpoints', {
      data: this.apiEndpoint,
    });

    const service = await serviceResponse.json();
    const entity = await entityResponse.json();
    const apiEndpoint = await apiEndpointResponse.json();

    this.serviceResponseData = service;
    this.entityResponseData = entity;
    this.apiEndpointResponseData = apiEndpoint;

    return {
      service,
      entity,
      apiEndpoint,
    };
  }

  async patch(apiContext: APIRequestContext, payload: Operation[]) {
    const apiCollectionResponse = await apiContext.patch(
      `/api/v1/apiCollections/name/${this.entityResponseData?.['fullyQualifiedName']}`,
      {
        data: payload,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    const apiCollection = await apiCollectionResponse.json();

    this.entityResponseData = apiCollection;

    return apiCollection;
  }

  get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
      apiEndpoint: this.apiEndpointResponseData,
    };
  }

  async visitEntityPage(page: Page) {
    await visitServiceDetailsPage(
      page,
      {
        name: this.service.name,
        type: SERVICE_TYPE.ApiService,
      },
      false
    );

    const apiCollectionsResponse = page.waitForResponse(
      `/api/v1/apiCollections/name/*${this.entity}?*`
    );
    await page.getByTestId(this.entity.name).click();
    await apiCollectionsResponse;
  }

  async delete(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.delete(
      `/api/v1/services/apiServices/name/${encodeURIComponent(
        this.serviceResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
    };
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
