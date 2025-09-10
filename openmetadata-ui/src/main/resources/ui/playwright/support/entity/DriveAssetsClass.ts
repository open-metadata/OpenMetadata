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
import { uuid } from '../../utils/common';
import { visitEntityPage } from '../../utils/entity';
import {
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
} from './Entity.interface';
import { EntityClass } from './EntityClass';

export class DriveAssetsClass extends EntityClass {
  private directoryName1 = `pw-directory-${uuid()}`;
  private directoryName2 = `pw-directory-${uuid()}`;
  private fileName = `pw-file-${uuid()}`;
  private spreadsheetName = `pw-spreadsheet-${uuid()}`;
  private worksheetName = `pw-worksheet-${uuid()}`;
  private serviceName = `pw-directory-service-${uuid()}`;

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

  worksheetColumns = [
    {
      name: `segment_name-${uuid()}`,
      displayName: 'Segment Name',
      dataType: 'STRING',
      dataTypeDisplay: 'string',
    },
    {
      name: `customer_count-${uuid()}`,
      displayName: 'Customer Count',
      dataType: 'INT',
      dataTypeDisplay: 'int',
      children: [
        {
          name: `ltv-${uuid()}`,
          displayName: 'Lifetime Value',
          dataType: 'DECIMAL',
          dataTypeDisplay: 'decimal(12,2)',
          children: [],
        },
      ],
    },
    {
      name: `avg_revenue_per_customer-${uuid()}`,
      displayName: 'Avg Revenue per Customer',
      dataType: 'DECIMAL',
      dataTypeDisplay: 'decimal(10,2)',
      children: [],
    },
  ];
  entity = {
    name: this.directoryName1,
    displayName: this.directoryName1,
    service: this.service.name,
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  entityResponseData2: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  fileResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  spreadsheetResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  worksheetResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;

  constructor(name?: string) {
    super(EntityTypeEndpoint.Directory);
    this.service.name = name ?? this.service.name;
    this.type = 'Directory';
    this.serviceCategory = SERVICE_TYPE.DriveService;
    this.serviceType = ServiceTypes.DRIVE_SERVICES;
    this.childrenSelectorId = `${this.service.name}.${this.directoryName1}`;
  }

  async create(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/driveServices',
      {
        data: this.service,
      }
    );
    this.serviceResponseData = await serviceResponse.json();

    // Create directories
    const directoryResponse1 = await apiContext.post(
      '/api/v1/drives/directories',
      {
        data: {
          name: this.directoryName1,
          service: this.serviceResponseData.fullyQualifiedName,
        },
      }
    );
    const directoryResponse2 = await apiContext.post(
      '/api/v1/drives/directories',
      {
        data: {
          name: this.directoryName2,
          service: this.serviceResponseData.fullyQualifiedName,
        },
      }
    );
    this.entityResponseData = await directoryResponse1.json();
    this.entityResponseData2 = await directoryResponse2.json();

    // Create file in directory 1
    const fileResponse = await apiContext.post('/api/v1/drives/files', {
      data: {
        name: this.fileName,
        directory: this.entityResponseData.fullyQualifiedName,
        service: this.serviceResponseData.fullyQualifiedName,
      },
    });
    this.fileResponseData = await fileResponse.json();

    // Create spreadsheet in directory 1
    const spreadsheetResponse = await apiContext.post(
      '/api/v1/drives/spreadsheets',
      {
        data: {
          name: this.spreadsheetName,
          service: this.serviceResponseData.fullyQualifiedName,
          parent: {
            id: this.entityResponseData.id,
            type: 'directory',
          },
        },
      }
    );
    this.spreadsheetResponseData = await spreadsheetResponse.json();

    // Create worksheet in spreadsheet
    const worksheetResponse = await apiContext.post(
      '/api/v1/drives/worksheets',
      {
        data: {
          name: this.worksheetName,
          spreadsheet: this.spreadsheetResponseData.fullyQualifiedName,
          columns: this.worksheetColumns,
        },
      }
    );
    this.worksheetResponseData = await worksheetResponse.json();

    return {
      service: serviceResponse.body,
      directory1: directoryResponse1.body,
      directory2: directoryResponse2.body,
      file: fileResponse.body,
      spreadsheet: spreadsheetResponse.body,
      worksheet: worksheetResponse.body,
    };
  }

  async patchAsset({
    apiContext,
    assetType,
    patchData,
  }: {
    apiContext: APIRequestContext;
    assetType:
      | 'directory1'
      | 'directory2'
      | 'file'
      | 'spreadsheet'
      | 'worksheet';
    patchData: Operation[];
  }) {
    const data = await this.getAssetData();
    const api = data[assetType].api;
    const fqn = data[assetType].fqn;

    const response = await apiContext.patch(`/api/v1/${api}/name/${fqn}`, {
      data: patchData,
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    });

    this.entityResponseData = await response.json();

    return {
      entity: this.entityResponseData,
    };
  }

  async getAssetData() {
    return {
      directory1: {
        api: EntityTypeEndpoint.Directory,
        fqn: this.entityResponseData.fullyQualifiedName,
      },
      directory2: {
        api: EntityTypeEndpoint.Directory,
        fqn: this.entityResponseData2.fullyQualifiedName,
      },
      file: {
        api: EntityTypeEndpoint.File,
        fqn: this.fileResponseData.fullyQualifiedName,
      },
      spreadsheet: {
        api: EntityTypeEndpoint.Spreadsheet,
        fqn: this.spreadsheetResponseData.fullyQualifiedName,
      },
      worksheet: {
        api: EntityTypeEndpoint.Worksheet,
        fqn: this.worksheetResponseData.fullyQualifiedName,
      },
    };
  }

  async get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
    };
  }

  async visitEntityPage(page: Page) {
    await visitEntityPage({
      page,
      searchTerm: this.entityResponseData?.['fullyQualifiedName'],
      dataTestId: `${this.service.name}-${this.entityResponseData.name}`,
    });
  }

  async delete(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.delete(
      `/api/v1/services/driveServices/name/${encodeURIComponent(
        this.serviceResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
    };
  }
}
