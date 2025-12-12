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
import { isUndefined } from 'lodash';
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

export class ContainerClass extends EntityClass {
  private containerName: string;
  private childContainerName: string;
  service: {
    name: string;
    serviceType: string;
    connection: {
      config: {
        type: string;
        awsConfig: {
          awsAccessKeyId: string;
          awsSecretAccessKey: string;
          awsRegion: string;
          assumeRoleSessionName: string;
        };
        supportsMetadataExtraction: boolean;
      };
    };
  };
  entity: {
    name: string;
    displayName: string;
    description: string;
    service: string;
    dataModel: {
      isPartitioned: boolean;
      columns: Array<{
        name: string;
        dataType: string;
        dataLength?: number;
        dataTypeDisplay: string;
        description: string;
        tags: unknown[];
        ordinalPosition: number;
        constraint?: string;
      }>;
    };
  };
  childContainer: {
    name: string;
    displayName: string;
    service: string;
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  childResponseData: ResponseDataType = {} as ResponseDataType;
  childArrayResponseData: ResponseDataType[] = [];

  constructor(name?: string) {
    super(EntityTypeEndpoint.Container);

    this.containerName = `pw-container-${uuid()}`;
    this.childContainerName = `pw-container-${uuid()}`;

    this.service = {
      name: name ?? `pw-storage-service-${uuid()}`,
      serviceType: 'S3',
      connection: {
        config: {
          type: 'S3',
          awsConfig: {
            awsAccessKeyId: 'admin',
            awsSecretAccessKey: 'key',
            awsRegion: 'us-east-2',
            assumeRoleSessionName: 'OpenMetadataSession',
          },
          supportsMetadataExtraction: true,
        },
      },
    };

    this.entity = {
      name: this.containerName,
      displayName: this.containerName,
      service: this.service.name,
      description: `Description for ${this.containerName}`,
      dataModel: {
        isPartitioned: true,
        columns: [
          {
            name: `merchant${uuid()}`,
            dataType: 'VARCHAR',
            dataLength: 100,
            dataTypeDisplay: 'varchar',
            description: 'The merchant for this transaction.',
            tags: [],
            ordinalPosition: 2,
          },
          {
            name: `columbia${uuid()}`,
            dataType: 'NUMERIC',
            dataTypeDisplay: 'numeric',
            description:
              'The ID of the executed transaction. This column is the primary key for this table.',
            tags: [],
            constraint: 'PRIMARY_KEY',
            ordinalPosition: 1,
          },
          {
            name: `delivery${uuid()}`,
            dataType: 'TIMESTAMP',
            dataTypeDisplay: 'timestamp',
            description: 'The time the transaction took place.',
            tags: [],
            ordinalPosition: 3,
          },
        ],
      },
    };

    this.childContainer = {
      name: this.childContainerName,
      displayName: this.childContainerName,
      service: this.service.name,
    };

    this.serviceType = ServiceTypes.STORAGE_SERVICES;
    this.type = 'Container';
    this.serviceCategory = SERVICE_TYPE.Storage;
    this.childrenSelectorId = `${this.entity.dataModel.columns[0].name}`;
  }

  async create(
    apiContext: APIRequestContext,
    customChildContainer?: { name: string; displayName: string }[]
  ) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/storageServices',
      {
        data: this.service,
      }
    );
    const entityResponse = await apiContext.post('/api/v1/containers', {
      data: this.entity,
    });

    this.serviceResponseData = await serviceResponse.json();
    this.entityResponseData = await entityResponse.json();

    if (!isUndefined(customChildContainer)) {
      const childArrayResponseData: ResponseDataType[] = [];
      for (const child of customChildContainer) {
        const childContainer = {
          ...child,
          service: this.service.name,
          parent: {
            id: this.entityResponseData.id,
            type: 'container',
          },
        };
        const childResponse = await apiContext.post('/api/v1/containers', {
          data: childContainer,
        });

        childArrayResponseData.push(await childResponse.json());
      }
      this.childArrayResponseData = childArrayResponseData;
    } else {
      const childContainer = {
        ...this.childContainer,
        parent: {
          id: this.entityResponseData.id,
          type: 'container',
        },
      };

      const childResponse = await apiContext.post('/api/v1/containers', {
        data: childContainer,
      });

      this.childResponseData = await childResponse.json();
    }

    return {
      service: serviceResponse.body,
      entity: entityResponse.body,
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
      `/api/v1/containers/name/${this.entityResponseData?.['fullyQualifiedName']}`,
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
    };
  }

  public set(data: {
    entity: ResponseDataWithServiceType;
    service: ResponseDataType;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
  }

  async visitEntityPage(page: Page) {
    await visitEntityPage({
      page,
      searchTerm: this.entityResponseData?.['fullyQualifiedName'],
      dataTestId: `${
        this.entityResponseData.service.name ?? this.service.name
      }-${this.entityResponseData.name ?? this.entity.name}`,
    });
  }

  async delete(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.delete(
      `/api/v1/services/storageServices/name/${encodeURIComponent(
        this.serviceResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
    };
  }
}
