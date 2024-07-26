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
import { SERVICE_TYPE } from '../../constant/service';
import { uuid } from '../../utils/common';
import { visitServiceDetailsPage } from '../../utils/service';
import { EntityTypeEndpoint } from './Entity.interface';
import { EntityClass } from './EntityClass';

export class ApiCollectionClass extends EntityClass {
  service = {
    name: `pw-api-service-${uuid()}`,
    serviceType: 'REST',
    connection: {
      config: {
        type: 'REST',
        openAPISchemaURL: 'https://sandbox-beta.open-metadata.org/swagger.json',
      },
    },
  };

  entity = {
    name: `pw-api-collection-${uuid()}`,
    service: this.service.name,
  };

  serviceResponseData: unknown;
  entityResponseData: unknown;

  constructor(name?: string) {
    super(EntityTypeEndpoint.API_COLLECTION);
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

    const service = await serviceResponse.json();
    const entity = await entityResponse.json();

    this.serviceResponseData = service;
    this.entityResponseData = entity;

    return {
      service,
      entity,
    };
  }

  get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
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
}
