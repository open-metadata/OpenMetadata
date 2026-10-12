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
import { ServiceTypes } from '../../constant/settings';
import {
  createOrFetch,
  okJson,
  withNotFoundRetry,
} from '../../utils/apiResponse';
import {
  uuid,
  verifyDomainLinkInCard,
  waitForSearchResult,
} from '../../utils/common';
import { setDomain } from '../../utils/domainPicker';
import {
  addMultiOwner,
  addOwner,
  removeOwner,
  updateOwner,
  visitEntityPage,
  visitEntityPageByFqn,
} from '../../utils/entity';
import { Domain } from '../domain/Domain';
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
 * Without `service` the database sits in the shard's shared database
 * service. Pass a DatabaseServiceClass when the test visits, mutates or
 * asserts on the service itself.
 */
export type DatabaseClassOptions = {
  name?: string;
  service?: DatabaseServiceClass;
  sharedInfraKey?: string;
};

export class DatabaseClass extends EntityClass implements ParentNode {
  readonly parentLevel = 'database' as const;
  private readonly serviceOverride?: DatabaseServiceClass;
  service = new DatabaseServiceClass().entity;
  entity = {
    name: `pw-database-${uuid()}`,
    service: this.service.name,
    description: 'description',
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

  constructor(options: DatabaseClassOptions = {}) {
    super(EntityTypeEndpoint.Database);
    this.type = 'Database';
    this.serviceType = ServiceTypes.DATABASE_SERVICES;
    this.serviceOverride = options.service;
    this.sharedInfraKey = options.sharedInfraKey;
    if (options.service) {
      this.service = options.service.entity;
    }
    if (options.name) {
      this.entity.name = options.name;
    }
    this.bindServiceName(this.service.name);
  }

  private bindServiceName(serviceName: string) {
    this.service = { ...this.service, name: serviceName };
    this.entity.service = serviceName;
    this.schema.database = `${serviceName}.${this.entity.name}`;
    this.table.databaseSchema = `${serviceName}.${this.entity.name}.${this.schema.name}`;
  }

  /**
   * Creates the database alone. As a test's parent override it must not seed
   * its fixture schema and table: the resolver creates the levels below it.
   */
  async createAsParent(apiContext: APIRequestContext) {
    const { parents, ownedRootPath, ownedOverride } = await resolveParents(
      apiContext,
      'database',
      { service: this.serviceOverride },
      this.sharedInfraKey,
      'service'
    );
    const service = parents.service as ResponseDataType;
    this.adoptOwnership({ ownedRootPath, ownedOverride });
    this.bindServiceName(service.name);

    const entity = await createOrFetch(apiContext, {
      label: 'DatabaseClass.create database',
      createPath: '/api/v1/databases',
      fqnSegments: [this.service.name, this.entity.name],
      data: this.entity,
    });
    this.serviceResponseData = service;
    this.entityResponseData = entity;

    return { service, entity };
  }

  async create(apiContext: APIRequestContext) {
    const { service, entity } = await this.createAsParent(apiContext);
    const schema = await createOrFetch(apiContext, {
      label: 'DatabaseClass.create schema',
      createPath: '/api/v1/databaseSchemas',
      fqnSegments: [this.service.name, this.entity.name, this.schema.name],
      data: this.schema,
    });
    const table = await createOrFetch(apiContext, {
      label: 'DatabaseClass.create table',
      createPath: '/api/v1/tables',
      fqnSegments: [
        this.service.name,
        this.entity.name,
        this.schema.name,
        this.table.name,
      ],
      data: this.table,
    });

    this.schemaResponseData = schema;
    this.tableResponseData = table;

    return {
      service,
      entity,
      table,
      schema,
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
      apiContext.patch(`/api/v1/databases/${this.entityResponseData?.['id']}`, {
        data: patchData,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      })
    );
    const entity = await okJson(serviceResponse, 'DatabaseClass.patch');

    this.entityResponseData = entity;

    return entity;
  }

  get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
      schema: this.schemaResponseData,
      table: this.tableResponseData,
      ownedRootPath: this.ownedRootPath,
    };
  }

  public set(data: {
    entity: ResponseDataWithServiceType;
    service: ResponseDataType;
    schema: ResponseDataWithServiceType;
    table: ResponseDataWithServiceType;
    ownedRootPath?: string;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.schemaResponseData = data.schema;
    this.tableResponseData = data.table;
    this.ownedRootPath = data.ownedRootPath;
    this.entity.name = data.entity.name;
    this.schema.name = data.schema.name;
    this.table.name = data.table.name;
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
      database: this.entityResponseData,
    };
  }

  rootDeletePath() {
    return this.ownedRootPath ?? this.databasePath();
  }

  private databasePath() {
    return parentDeletePath(
      'databases',
      this.entityResponseData?.fullyQualifiedName ?? ''
    );
  }

  // FQN navigation: the shared service page paginates its databases, so
  // clicking through it can miss this one.
  async visitEntityPage(page: Page) {
    await visitEntityPageByFqn({
      page,
      endpoint: EntityTypeEndpoint.Database,
      fqn: this.entityResponseData?.fullyQualifiedName ?? '',
    });
  }

  async delete(apiContext: APIRequestContext) {
    await this.deleteOwnedOrLeaf(apiContext, this.databasePath());

    return { entity: this.entityResponseData };
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
    await expect(page.getByRole('link', { name: owner })).toBeVisible();
  }

  async verifyOwnerChangeInES(page: Page, owner: string) {
    const searchTerm = this.tableResponseData?.['fullyQualifiedName'];
    const ownerLink = page
      .getByTestId(`table-data-card_${searchTerm}`)
      .getByTestId('owner-label')
      .getByTestId('owner-link')
      .getByTestId(owner);
    const tableTab = page
      .getByTestId('explore-left-panel')
      .getByRole('tab', { name: 'Tables' });

    await waitForSearchResult(page, searchTerm, ownerLink, tableTab, {
      owners: [owner],
    });
    await expect(ownerLink).toBeVisible();
  }

  async verifyDomainChangeInES(page: Page, domains: Domain['responseData'][]) {
    const searchTerm = this.tableResponseData?.['fullyQualifiedName'];
    const entityCard = page.getByTestId(`table-data-card_${searchTerm}`);
    const tableTab = page
      .getByTestId('explore-left-panel')
      .getByRole('tab', { name: 'Tables' });

    for (const domain of domains) {
      const domainLink = entityCard
        .getByTestId('domain-link')
        .filter({ hasText: domain.displayName });
      await waitForSearchResult(page, searchTerm, domainLink, tableTab, {
        domains: [domain.fullyQualifiedName ?? domain.name],
      });
      await verifyDomainLinkInCard(entityCard, domain);
    }

    await page.getByTestId('searchBox').clear();
  }

  async verifyOwnerPropagation(page: Page, owner: string) {
    await this.verifyOwnerChangeInDetailsPage(page, owner);
    await this.verifyOwnerChangeInES(page, owner);
    await this.visitEntityPage(page);
  }

  async verifyDomainPropagation(page: Page, domain: Domain['responseData']) {
    await this.verifyDomainChangeInES(page, [domain]);
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
    await setDomain(page, domain1);
    await this.verifyDomainPropagation(page, domain1);
    await setDomain(page, domain1, { verify: 'cleared' });
    await setDomain(page, domain2);
    await setDomain(page, domain2, { verify: 'cleared' });
  }
}
