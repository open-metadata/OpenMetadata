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

export class WorksheetClass extends EntityClass {
  private readonly spreadsheetName = `pw-spreadsheet-${uuid()}`;
  private readonly worksheetName = `pw-worksheet-${uuid()}`;
  private readonly serviceName = `pw-worksheet-service-${uuid()}`;

  service = {
    name: this.serviceName,
    serviceType: 'GoogleDrive',
    connection: {
      config: {
        type: 'GoogleDrive',
        driveId: '0APBVnJtQ-NLCUk9PVA',
        credentials: {
          gcpConfig: {
            type: 'service_account',
            authUri: 'https://accounts.google.com/o/oauth2/auth',
            clientId: '123456789',
            tokenUri: 'https://oauth2.googleapis.com/token',
            projectId: 'sample-project-id',
            privateKey: '1234567890',
            clientEmail: 'sample-sa@sample-project.iam.gserviceaccount.com',
            privateKeyId: 'sample-private-key-id',
            clientX509CertUrl:
              'https://www.googleapis.com/robot/v1/metadata/x509/sample-sa%40sample-project.iam.gserviceaccount.com',
            authProviderX509CertUrl:
              'https://www.googleapis.com/oauth2/v1/certs',
          },
        },
        supportsMetadataExtraction: true,
      },
    },
  };

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

  constructor(name?: string) {
    super(EntityTypeEndpoint.Worksheet);
    this.service.name = name ?? this.service.name;
    this.type = 'Worksheet';
    this.serviceCategory = SERVICE_TYPE.DriveService;
    this.serviceType = ServiceTypes.DRIVE_SERVICES;

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

    this.childrenSelectorId = `${this.service.name}.${this.spreadsheetName}.${this.worksheetName}.${this.children[0].name}`;
    this.entity = {
      name: this.worksheetName,
      displayName: this.worksheetName,
      service: this.service.name,
      description: 'description',
      columns: this.children,
    };
  }

  // createOrFetch, not a bare POST — see FileClass.create for why: the names are
  // fixed at construction, so a retried beforeAll re-creates them and 409s.
  async create(apiContext: APIRequestContext) {
    this.serviceResponseData = await createOrFetch(apiContext, {
      label: 'WorksheetClass.create service',
      createPath: '/api/v1/services/driveServices',
      fqnSegments: [this.service.name],
      data: this.service,
    });

    // Create spreadsheet
    this.spreadsheetResponseData = await createOrFetch(apiContext, {
      label: 'WorksheetClass.create spreadsheet',
      createPath: `/api/v1/${EntityTypeEndpoint.Spreadsheet}`,
      fqnSegments: [this.service.name, this.spreadsheetName],
      data: {
        name: this.spreadsheetName,
        service: this.serviceResponseData.fullyQualifiedName,
      },
    });

    // Create worksheet in spreadsheet. `columns` is in WorksheetResource.FIELDS,
    // so a by-name lookup omits it unless asked — and childrenSelectorId below
    // reads columns[0].
    this.entityResponseData = await createOrFetch<Worksheet>(apiContext, {
      label: 'WorksheetClass.create worksheet',
      createPath: `/api/v1/${EntityTypeEndpoint.Worksheet}`,
      fqnSegments: [
        this.service.name,
        this.spreadsheetName,
        this.worksheetName,
      ],
      fields: 'columns',
      data: {
        ...this.entity,
        spreadsheet: this.spreadsheetResponseData.fullyQualifiedName,
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
    };
  }

  public set(data: {
    entity: Worksheet;
    service: ResponseDataType;
    spreadsheet: ResponseDataType;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.spreadsheetResponseData = data.spreadsheet;
  }

  async visitEntityPage(page: Page) {
    await visitEntityPageByFqn({
      page,
      endpoint: this.endpoint,
      fqn: this.entityResponseData?.fullyQualifiedName ?? '',
    });
  }

  async delete(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.delete(
      `/api/v1/services/driveServices/name/${encodeURIComponent(
        this.serviceResponseData?.fullyQualifiedName ?? ''
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
    };
  }
}
