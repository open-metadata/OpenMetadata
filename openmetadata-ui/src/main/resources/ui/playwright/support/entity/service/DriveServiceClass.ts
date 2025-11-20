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
import { SERVICE_TYPE } from '../../../constant/service';
import { uuid } from '../../../utils/common';
import { visitServiceDetailsPage } from '../../../utils/service';
import { EntityTypeEndpoint, ResponseDataType } from '../Entity.interface';
import { EntityClass } from '../EntityClass';

export class DriveServiceClass extends EntityClass {
  entity = {
    name: `pw-drive-service-${uuid()}`,
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

  entityResponseData: ResponseDataType = {} as ResponseDataType;

  constructor(name?: string) {
    super(EntityTypeEndpoint.DriveService);
    this.entity.name = name ?? this.entity.name;
    this.type = 'Drive Service';
  }

  async create(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.post(
      `/api/v1/${EntityTypeEndpoint.DriveService}`,
      {
        data: this.entity,
      }
    );

    const service = await serviceResponse.json();

    this.entityResponseData = service;

    return service;
  }

  async patch(apiContext: APIRequestContext, payload: Operation[]) {
    const serviceResponse = await apiContext.patch(
      `/api/v1/${EntityTypeEndpoint.DriveService}/${this.entityResponseData?.['id']}`,
      {
        data: payload,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    const service = await serviceResponse.json();

    this.entityResponseData = service;

    return service;
  }

  get() {
    return this.entityResponseData;
  }

  set(data: ResponseDataType) {
    this.entityResponseData = data;
  }

  async visitEntityPage(page: Page) {
    await visitServiceDetailsPage(
      page,
      {
        name: this.entity.name,
        type: SERVICE_TYPE.DriveService,
      },
      false
    );
  }

  async delete(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.delete(
      `/api/v1/${EntityTypeEndpoint.DriveService}/name/${encodeURIComponent(
        this.entityResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    return await serviceResponse.json();
  }
}
