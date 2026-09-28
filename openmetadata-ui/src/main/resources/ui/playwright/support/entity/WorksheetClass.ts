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
  Column,
  DataType,
  Worksheet,
} from '../../../src/generated/entity/data/worksheet';
import { SERVICE_TYPE } from '../../constant/service';
import { ServiceTypes } from '../../constant/settings';
import {
  createOrFetch,
  okJson,
  withNotFoundRetry,
} from '../../utils/apiResponse';
import { uuid } from '../../utils/common';
import { visitEntityPageByFqn } from '../../utils/entity';
import { EntityTypeEndpoint, ResponseDataType } from './Entity.interface';
import { EntityClass } from './EntityClass';
import { resolveParents } from './ParentResolver';
import { DriveServiceClass } from './service/DriveServiceClass';
import type { SpreadsheetClass } from './SpreadsheetClass';

/**
 * Without a parent the worksheet sits in the shard's shared drive service →
 * spreadsheet chain. Pass the deepest parent the test needs to own:
 *   - `service` — own service page, unique service name or service-level
 *     cascade;
 *   - `spreadsheet` — mutates the spreadsheet or asserts on its worksheet
 *     listing.
 * Levels below the one passed are created fresh and deleted with the worksheet.
 */
export type WorksheetClassOptions = {
  name?: string;
  service?: DriveServiceClass;
  spreadsheet?: SpreadsheetClass;
  sharedInfraKey?: string;
};

export class WorksheetClass extends EntityClass {
  service: DriveServiceClass['entity'];

  children: Column[];
  entity: {
    name: string;
    displayName: string;
    service: string;
    description: string;
    columns?: Column[];
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: Worksheet = {} as Worksheet;
  spreadsheetResponseData: ResponseDataType = {} as ResponseDataType;

  private readonly parentOverrides: Pick<
    WorksheetClassOptions,
    'service' | 'spreadsheet'
  >;

  constructor(options: WorksheetClassOptions = {}) {
    super(EntityTypeEndpoint.Worksheet);
    this.type = 'Worksheet';
    this.serviceCategory = SERVICE_TYPE.DriveService;
    this.serviceType = ServiceTypes.DRIVE_SERVICES;
    this.sharedInfraKey = options.sharedInfraKey;
    this.parentOverrides = {
      service: options.service,
      spreadsheet: options.spreadsheet,
    };
    // Placeholder parent names until create() binds the resolved chain.
    this.service = options.service?.entity ?? new DriveServiceClass().entity;
    const spreadsheetName = `pw-spreadsheet-${uuid()}`;
    const worksheetName = options.name ?? `pw-worksheet-${uuid()}`;

    this.children = [
      {
        name: `segment_name-${uuid()}`,
        displayName: 'Segment Name',
        dataType: DataType.String,
        dataTypeDisplay: 'string',
      },
      {
        name: `customer_count-${uuid()}`,
        displayName: 'Customer Count',
        dataType: DataType.Int,
        dataTypeDisplay: 'int',
        children: [
          {
            name: `ltv-${uuid()}`,
            displayName: 'Lifetime Value',
            dataType: DataType.Decimal,
            dataTypeDisplay: 'decimal(12,2)',
            children: [
              {
                name: `number`,
                displayName: 'Number',
                dataType: DataType.Decimal,
                dataTypeDisplay: 'decimal(12,2)',
                children: [],
              },
            ],
          },
        ],
      },
      {
        name: `avg_revenue_per_customer-${uuid()}`,
        displayName: 'Avg Revenue per Customer',
        dataType: DataType.Decimal,
        dataTypeDisplay: 'decimal(10,2)',
        children: [],
      },
    ];

    this.childrenSelectorId = `${this.service.name}.${spreadsheetName}.${worksheetName}.${this.children[0].name}`;
    this.entity = {
      name: worksheetName,
      displayName: worksheetName,
      service: this.service.name,
      description: 'description',
      columns: this.children,
    };
  }

  // createOrFetch, not a bare POST — see FileClass.create for why: the names are
  // fixed at construction, so a retried beforeAll re-creates them and 409s.
  async create(apiContext: APIRequestContext) {
    const { parents, ownedRootPath } = await resolveParents(
      apiContext,
      'driveSpreadsheet',
      this.parentOverrides,
      this.sharedInfraKey
    );
    const service = parents.service as ResponseDataType;
    const spreadsheet = parents.spreadsheet as ResponseDataType;
    this.ownedRootPath = ownedRootPath;
    this.bindServiceName(service.name);
    this.serviceResponseData = service;
    this.spreadsheetResponseData = spreadsheet;

    // Create worksheet in spreadsheet. `columns` is in WorksheetResource.FIELDS,
    // so a by-name lookup omits it unless asked — and childrenSelectorId below
    // reads columns[0].
    this.entityResponseData = await createOrFetch<Worksheet>(apiContext, {
      label: 'WorksheetClass.create worksheet',
      createPath: `/api/v1/${EntityTypeEndpoint.Worksheet}`,
      fqnSegments: [service.name, spreadsheet.name, this.entity.name],
      fields: 'columns',
      data: {
        ...this.entity,
        spreadsheet: spreadsheet.fullyQualifiedName,
      },
    });

    this.childrenSelectorId =
      this.entityResponseData.columns?.[0]?.fullyQualifiedName ?? '';

    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
      spreadsheet: this.spreadsheetResponseData,
    };
  }

  private bindServiceName(serviceName: string) {
    this.service = { ...this.service, name: serviceName };
    this.entity.service = serviceName;
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
        `/api/v1/${EntityTypeEndpoint.Worksheet}/name/${this.entityResponseData.fullyQualifiedName}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );

    this.entityResponseData = await okJson(response, 'WorksheetClass.patch');

    return {
      entity: this.entityResponseData,
    };
  }

  get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
      spreadsheet: this.spreadsheetResponseData,
      ownedRootPath: this.ownedRootPath,
    };
  }

  public set(data: {
    entity: Worksheet;
    service: ResponseDataType;
    spreadsheet: ResponseDataType;
    ownedRootPath?: string;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.spreadsheetResponseData = data.spreadsheet;
    this.ownedRootPath = data.ownedRootPath;
    this.entity.name = data.entity.name;
    this.bindServiceName(data.service.name);
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
      `/api/v1/${EntityTypeEndpoint.Worksheet}/${this.entityResponseData?.id}`
    );

    return { entity: this.entityResponseData };
  }
}
