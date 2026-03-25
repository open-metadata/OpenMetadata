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
import { uuid } from '../../utils/common';
import { visitEntityPage } from '../../utils/entity';
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

  async create(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/driveServices',
      {
        data: this.service,
      }
    );
    this.serviceResponseData = await serviceResponse.json();

    // Create spreadsheet
    const spreadsheetResponse = await apiContext.post(
      `/api/v1/${EntityTypeEndpoint.Spreadsheet}`,
      {
        data: {
          name: this.spreadsheetName,
          service: this.serviceResponseData.fullyQualifiedName,
        },
      }
    );
    this.spreadsheetResponseData = await spreadsheetResponse.json();

    // Create worksheet in spreadsheet
    const entityResponse = await apiContext.post(
      `/api/v1/${EntityTypeEndpoint.Worksheet}`,
      {
        data: {
          ...this.entity,
          spreadsheet: this.spreadsheetResponseData.fullyQualifiedName,
        },
      }
    );
    this.entityResponseData = await entityResponse.json();

    this.childrenSelectorId =
      this.entityResponseData.columns?.[0]?.fullyQualifiedName ?? '';

    return {
      service: serviceResponse.body,
      entity: entityResponse.body,
      spreadsheet: spreadsheetResponse.body,
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
      `/api/v1/${EntityTypeEndpoint.Worksheet}/name/${this.entityResponseData.fullyQualifiedName}`,
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
      `/api/v1/services/driveServices/name/${encodeURIComponent(
        this.serviceResponseData?.fullyQualifiedName ?? ''
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
    };
  }
}
