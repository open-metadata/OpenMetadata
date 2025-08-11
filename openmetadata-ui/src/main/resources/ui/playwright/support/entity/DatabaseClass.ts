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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import { SERVICE_TYPE } from '../../constant/service';
import { ServiceTypes } from '../../constant/settings';
import {
  assignDomain,
  removeDomain,
  updateDomain,
  uuid,
} from '../../utils/common';
import {
  addMultiOwner,
  addOwner,
  removeOwner,
  updateOwner,
  visitEntityPage,
} from '../../utils/entity';
import { visitServiceDetailsPage } from '../../utils/service';
import { Domain } from '../domain/Domain';
import {
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
} from './Entity.interface';
import { EntityClass } from './EntityClass';

export class DatabaseClass extends EntityClass {
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
  entity = {
    name: `pw-database-${uuid()}`,
    service: this.service.name,
  };
  schema = {
    name: `pw-database-schema-${uuid()}`,
    database: `${this.service.name}.${this.entity.name}`,
  };

  table = {
    name: `pw-table-${uuid()}`,
    description: 'description',
    columns: [
      {
        name: 'user_id',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        description:
          'Unique identifier for the user of your Shopify POS or your Shopify admin.',
      },
      {
        name: 'shop_id',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        description:
          'The ID of the store. This column is a foreign key reference to the shop_id column in the dim.shop table.',
      },
      {
        name: 'name',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Name of the staff member.',
        children: [
          {
            name: 'first_name',
            dataType: 'VARCHAR',
            dataLength: 100,
            dataTypeDisplay: 'varchar',
            description: 'First name of the staff member.',
          },
          {
            name: 'last_name',
            dataType: 'VARCHAR',
            dataLength: 100,
            dataTypeDisplay: 'varchar',
          },
        ],
      },
      {
        name: 'email',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Email address of the staff member.',
      },
    ],
    databaseSchema: `${this.service.name}.${this.entity.name}.${this.schema.name}`,
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  schemaResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  tableResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;

  constructor(name?: string) {
    super(EntityTypeEndpoint.Database);
    this.service.name = name ?? this.service.name;
    this.type = 'Database';
    this.serviceType = ServiceTypes.DATABASE_SERVICES;
  }

  async create(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/databaseServices',
      {
        data: this.service,
      }
    );
    const entityResponse = await apiContext.post('/api/v1/databases', {
      data: this.entity,
    });

    const schemaResponse = await apiContext.post('/api/v1/databaseSchemas', {
      data: this.schema,
    });

    const tableResponse = await apiContext.post('/api/v1/tables', {
      data: this.table,
    });

    const service = await serviceResponse.json();
    const entity = await entityResponse.json();
    const schema = await schemaResponse.json();
    const table = await tableResponse.json();

    this.serviceResponseData = service;
    this.entityResponseData = entity;
    this.schemaResponseData = schema;
    this.tableResponseData = table;

    return {
      service,
      entity,
      table,
      schema,
    };
  }

  async patch(apiContext: APIRequestContext, payload: Operation[]) {
    const serviceResponse = await apiContext.patch(
      `/api/v1/databases/${this.entityResponseData?.['id']}`,
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
      entity: this.entityResponseData,
      schema: this.schemaResponseData,
      table: this.tableResponseData,
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
      `/api/v1/databases/name/*${this.entity.name}?**`
    );
    await page.getByTestId(this.entity.name).click();
    await databaseResponse;
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

  async verifyOwnerChangeInDetailsPage(page: Page, owner: string) {
    const databaseSchemaResponse = page.waitForResponse(
      `/api/v1/databaseSchemas/name/*${this.schema.name}?**`
    );
    await page.getByTestId(this.schema.name).click();
    await databaseSchemaResponse;

    await visitEntityPage({
      page,
      searchTerm: this.tableResponseData?.['fullyQualifiedName'],
      dataTestId: `${this.service.name}-${this.table.name}`,
    });
    await page.getByRole('link', { name: owner }).isVisible();
  }

  async verifyOwnerChangeInES(page: Page, owner: string) {
    // Verify owner change in ES
    const searchTerm = this.tableResponseData?.['fullyQualifiedName'];
    await page.getByTestId('searchBox').fill(searchTerm);
    await page.getByTestId('searchBox').press('Enter');

    await expect(
      page
        .getByTestId(`table-data-card_${searchTerm}`)
        .getByTestId('owner-label')
        .getByTestId('owner-link')
        .getByTestId(owner)
    ).toBeVisible();
  }

  async verifyDomainChangeInES(page: Page, domain: Domain['responseData']) {
    // Verify domain change in ES
    const searchTerm = this.tableResponseData?.['fullyQualifiedName'];
    await page.getByTestId('searchBox').fill(searchTerm);
    await page.getByTestId('searchBox').press('Enter');

    await expect(
      page
        .getByTestId(`table-data-card_${searchTerm}`)
        .getByTestId('domain-link')
    ).toContainText(domain.displayName);
  }

  async verifyOwnerPropagation(page: Page, owner: string) {
    await this.verifyOwnerChangeInDetailsPage(page, owner);
    await this.verifyOwnerChangeInES(page, owner);
    await this.visitEntityPage(page);
  }

  async verifyDomainPropagation(page: Page, domain: Domain['responseData']) {
    await this.verifyDomainChangeInES(page, domain);
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

  override async domain(
    page: Page,
    domain1: Domain['responseData'],
    domain2: Domain['responseData']
  ) {
    await assignDomain(page, domain1);
    await this.verifyDomainPropagation(page, domain1);
    await updateDomain(page, domain2);
    await removeDomain(page, domain2);
  }
}
