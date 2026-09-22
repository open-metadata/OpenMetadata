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
  File,
} from '../../../src/generated/entity/data/file';
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

export class FileClass extends EntityClass {
  private readonly fileName = `pw-file-${uuid()}`;
  private readonly directoryName = `pw-directory-${uuid()}`;
  private readonly serviceName = `pw-directory-service-${uuid()}`;

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
  directoryResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: File = {} as File;

  constructor(name?: string) {
    super(EntityTypeEndpoint.File);
    this.service.name = name ?? this.service.name;
    this.type = 'File';
    this.serviceCategory = SERVICE_TYPE.DriveService;
    this.serviceType = ServiceTypes.DRIVE_SERVICES;
    this.childrenSelectorId = `${this.service.name}.${this.fileName}`;
    this.children = [
      {
        name: 'sample_column_1',
        dataType: DataType.Bitmap,
      },
      {
        name: 'sample_column_2',
        dataType: DataType.Bitmap,
        children: [
          {
            name: 'nested_column_1',
            dataType: DataType.Bitmap,
            children: [
              {
                name: 'deeply_nested_column_1',
                dataType: DataType.Bigint,
              },
              {
                name: 'deeply_nested_column_2',
                dataType: DataType.Bigint,
              },
            ],
          },
          {
            name: 'nested_column_2',
            dataType: DataType.Bigint,
          },
        ],
      },
    ];
    this.entity = {
      name: this.fileName,
      displayName: this.fileName,
      service: this.service.name,
      description: 'description',
      columns: this.children,
    };
  }

  // createOrFetch, not a bare POST: these names are generated once, when the
  // class is constructed. Specs that build their fixtures in the describe body
  // (LineageFilters, for one) do not re-evaluate it on a retry, so beforeAll
  // runs a second time with the same names and every create answers 409
  // "Entity already exists" — the retry fails in the hook and takes the whole
  // file with it. Treating the conflict as success and fetching the entity
  // makes create idempotent, which is what a retry needs it to be.
  async create(apiContext: APIRequestContext) {
    this.serviceResponseData = await createOrFetch(apiContext, {
      label: 'FileClass.create service',
      createPath: '/api/v1/services/driveServices',
      fqnSegments: [this.service.name],
      data: this.service,
    });

    // Create directory
    this.directoryResponseData = await createOrFetch(apiContext, {
      label: 'FileClass.create directory',
      createPath: '/api/v1/drives/directories',
      fqnSegments: [this.service.name, this.directoryName],
      data: {
        name: this.directoryName,
        service: this.serviceResponseData.fullyQualifiedName,
      },
    });

    // Create file in directory. `columns` has to be requested explicitly: it is
    // in FileResource.FIELDS, so the POST returns it but a by-name lookup does
    // not, and the conflict path below reads columns[0] for childrenSelectorId.
    // Without it a retry would quietly leave that selector empty and fail later,
    // in a column test, rather than here.
    this.entityResponseData = await createOrFetch<File>(apiContext, {
      label: 'FileClass.create file',
      createPath: `/api/v1/${EntityTypeEndpoint.File}`,
      fqnSegments: [this.service.name, this.directoryName, this.fileName],
      fields: 'columns',
      data: {
        ...this.entity,
        directory: this.directoryResponseData.fullyQualifiedName,
      },
    });

    this.childrenSelectorId =
      this.entityResponseData.columns?.[0]?.fullyQualifiedName ?? '';

    return {
      service: this.serviceResponseData,
      directory: this.directoryResponseData,
      entity: this.entityResponseData,
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
        `/api/v1/${EntityTypeEndpoint.File}/name/${this.entityResponseData.fullyQualifiedName}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );

    this.entityResponseData = await okJson(response, 'FileClass.patch');

    return {
      entity: this.entityResponseData,
    };
  }

  get() {
    return {
      service: this.serviceResponseData,
      directory: this.directoryResponseData,
      entity: this.entityResponseData,
    };
  }

  public set(data: {
    entity: File;
    service: ResponseDataType;
    directory: ResponseDataType;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.directoryResponseData = data.directory;
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
