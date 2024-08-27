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
import {
  addMultiOwner,
  addOwner,
  removeOwner,
  updateOwner,
  visitEntityPage,
} from '../../utils/entity';
import { visitServiceDetailsPage } from '../../utils/service';
import { EntityTypeEndpoint } from './Entity.interface';
import { EntityClass } from './EntityClass';

export class ApiCollectionClass extends EntityClass {
  private serviceName = `pw-api-service-${uuid()}`;
  private apiCollectionName = `pw-api-collection-${uuid()}`;
  service = {
    name: this.serviceName,
    serviceType: 'REST',
    connection: {
      config: {
        type: 'REST',
        openAPISchemaURL: 'https://sandbox-beta.open-metadata.org/swagger.json',
      },
    },
  };

  entity = {
    name: this.apiCollectionName,
    service: this.service.name,
  };

  private apiEndpointName = `pw-api-endpoint-${uuid()}`;
  private fqn = `${this.service.name}.${this.entity.name}.${this.apiEndpointName}`;

  apiEndpoint = {
    name: this.apiEndpointName,
    apiCollection: `${this.service.name}.${this.entity.name}`,
    endpointURL: 'https://sandbox-beta.open-metadata.org/swagger.json',
    requestSchema: {
      schemaType: 'JSON',
      schemaFields: [
        {
          name: 'default',
          dataType: 'RECORD',
          fullyQualifiedName: `${this.fqn}.default`,
          tags: [],
          children: [
            {
              name: 'name',
              dataType: 'RECORD',
              fullyQualifiedName: `${this.fqn}.default.name`,
              tags: [],
              children: [
                {
                  name: 'first_name',
                  dataType: 'STRING',
                  description: 'Description for schema field first_name',
                  fullyQualifiedName: `${this.fqn}.default.name.first_name`,
                  tags: [],
                },
                {
                  name: 'last_name',
                  dataType: 'STRING',
                  fullyQualifiedName: `${this.fqn}.default.name.last_name`,
                  tags: [],
                },
              ],
            },
            {
              name: 'age',
              dataType: 'INT',
              fullyQualifiedName: `${this.fqn}.default.age`,
              tags: [],
            },
            {
              name: 'club_name',
              dataType: 'STRING',
              fullyQualifiedName: `${this.fqn}.default.club_name`,
              tags: [],
            },
          ],
        },
      ],
    },
    responseSchema: {
      schemaType: 'JSON',
      schemaFields: [
        {
          name: 'default',
          dataType: 'RECORD',
          fullyQualifiedName: `${this.fqn}.default`,
          tags: [],
          children: [
            {
              name: 'name',
              dataType: 'RECORD',
              fullyQualifiedName: `${this.fqn}.default.name`,
              tags: [],
              children: [
                {
                  name: 'first_name',
                  dataType: 'STRING',
                  fullyQualifiedName: `${this.fqn}.default.name.first_name`,
                  tags: [],
                },
                {
                  name: 'last_name',
                  dataType: 'STRING',
                  fullyQualifiedName: `${this.fqn}.default.name.last_name`,
                  tags: [],
                },
              ],
            },
            {
              name: 'age',
              dataType: 'INT',
              fullyQualifiedName: `${this.fqn}.default.age`,
              tags: [],
            },
            {
              name: 'club_name',
              dataType: 'STRING',
              fullyQualifiedName: `${this.fqn}.default.club_name`,
              tags: [],
            },
          ],
        },
      ],
    },
  };

  serviceResponseData: unknown;
  entityResponseData: unknown;
  apiEndpointResponseData: unknown;

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
    await visitEntityPage({
      page,
      searchTerm: this.apiEndpointResponseData?.['fullyQualifiedName'],
      dataTestId: `${this.service.name}-${this.apiEndpoint.name}`,
    });
    await page.getByRole('link', { name: owner }).isVisible();
    await this.visitEntityPage(page);
  }

  override async owner(
    page: Page,
    owner1: string[],
    owner2: string[],
    type: 'Teams' | 'Users' = 'Users',
    isEditPermission = true
  ) {
    if (type === 'Teams') {
      await addOwner({
        page,
        owner: owner1[0],
        type,
        endpoint: this.endpoint,
        dataTestId: 'data-assets-header',
      });
      if (isEditPermission) {
        await updateOwner({
          page,
          owner: owner2[0],
          type,
          endpoint: this.endpoint,
          dataTestId: 'data-assets-header',
        });
        await this.verifyOwnerPropagation(page, owner2[0]);

        await removeOwner({
          page,
          endpoint: this.endpoint,
          ownerName: owner2[0],
          type,
          dataTestId: 'data-assets-header',
        });
      }
    } else {
      await addMultiOwner({
        page,
        ownerNames: owner1,
        activatorBtnDataTestId: 'edit-owner',
        resultTestId: 'data-assets-header',
        endpoint: this.endpoint,
        type,
      });
      if (isEditPermission) {
        await addMultiOwner({
          page,
          ownerNames: owner2,
          activatorBtnDataTestId: 'edit-owner',
          resultTestId: 'data-assets-header',
          endpoint: this.endpoint,
          type,
        });
        await this.verifyOwnerPropagation(page, owner2[0]);
        await removeOwner({
          page,
          endpoint: this.endpoint,
          ownerName: owner2[0],
          type,
          dataTestId: 'data-assets-header',
        });
      }
    }
  }
}
