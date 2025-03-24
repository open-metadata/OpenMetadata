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

export class TopicClass extends EntityClass {
  service = {
    name: `pw-messaging-service-${uuid()}`,
    serviceType: 'Kafka',
    connection: {
      config: {
        type: 'Kafka',
        bootstrapServers: 'Bootstrap Servers',
        saslUsername: 'admin',
        saslPassword: 'admin',
        saslMechanism: 'PLAIN',
        supportsMetadataExtraction: true,
      },
    },
  };
  private topicName = `pw-topic-${uuid()}`;

  children = [
    {
      name: `default${uuid()}`,
      dataType: 'RECORD',
      tags: [],
      children: [
        {
          name: `name${uuid()}`,
          dataType: 'RECORD',
          tags: [],
          children: [
            {
              name: 'first_name',
              dataType: 'STRING',
              description: 'Description for schema field first_name',
              tags: [],
            },
            {
              name: 'last_name',
              dataType: 'STRING',
              tags: [],
            },
          ],
        },
        {
          name: 'age',
          dataType: 'INT',
          tags: [],
        },
        {
          name: 'club_name',
          dataType: 'STRING',
          tags: [],
        },
      ],
    },
    {
      name: `secondary${uuid()}`,
      dataType: 'RECORD',
      tags: [],
      children: [],
    },
  ];

  entity = {
    name: this.topicName,
    service: this.service.name,
    messageSchema: {
      schemaText: `{"type":"object","required":["name","age","club_name"],"properties":{"name":{"type":"object","required":["first_name","last_name"],
    "properties":{"first_name":{"type":"string"},"last_name":{"type":"string"}}},"age":{"type":"integer"},"club_name":{"type":"string"}}}`,
      schemaType: 'JSON',
      schemaFields: this.children,
    },
    partitions: 128,
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;

  constructor(name?: string) {
    super(EntityTypeEndpoint.Topic);
    this.service.name = name ?? this.service.name;
    this.type = 'Topic';
    this.childrenTabId = 'schema';
    this.childrenSelectorId = this.children[0].name;
    this.serviceCategory = SERVICE_TYPE.Messaging;
    this.serviceType = ServiceTypes.MESSAGING_SERVICES;
  }

  async create(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/messagingServices',
      {
        data: this.service,
      }
    );
    const entityResponse = await apiContext.post('/api/v1/topics', {
      data: this.entity,
    });

    this.serviceResponseData = await serviceResponse.json();
    this.entityResponseData = await entityResponse.json();

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
      `/api/v1/topics/name/${this.entityResponseData?.['fullyQualifiedName']}`,
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
      dataTestId: `${this.service.name}-${this.entity.name}`,
    });
  }

  async delete(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.delete(
      `/api/v1/services/messagingServices/name/${encodeURIComponent(
        this.serviceResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
    };
  }
}
