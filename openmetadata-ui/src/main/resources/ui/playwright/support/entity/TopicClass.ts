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
  DataTypeTopic,
  Field,
  Topic,
} from '../../../src/generated/entity/data/topic';
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
import { MessagingServiceClass } from './service/MessagingServiceClass';

/**
 * Without `service` the topic sits in the shard's shared messagingService.
 * Pass a MessagingServiceClass when the test needs its own service — to
 * assert on a unique service name, visit the service page, or mutate it.
 */
export type TopicClassOptions = {
  name?: string;
  service?: MessagingServiceClass;
  sharedInfraKey?: string;
};

export class TopicClass extends EntityClass {
  service = new MessagingServiceClass().entity;
  private readonly serviceOverride?: MessagingServiceClass;
  children: Field[];
  entity: {
    name: string;
    displayName: string;
    service: string;
    description: string;
    messageSchema: {
      schemaText: string;
      schemaType: string;
      schemaFields: Field[];
    };
    partitions: number;
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: Topic = {} as Topic;

  constructor(options: TopicClassOptions = {}) {
    super(EntityTypeEndpoint.Topic);
    this.type = 'Topic';
    this.childrenTabId = 'schema';
    this.serviceCategory = SERVICE_TYPE.Messaging;
    this.serviceType = ServiceTypes.MESSAGING_SERVICES;
    this.serviceOverride = options.service;
    this.sharedInfraKey = options.sharedInfraKey;
    if (options.service) {
      this.service = options.service.entity;
    }

    const topicName = options.name ?? `pw-topic-entity-class-${uuid()}`;

    this.children = [
      {
        name: `default${uuid()}`,
        dataType: DataTypeTopic.Record,
        tags: [],
        children: [
          {
            name: `name${uuid()}`,
            dataType: DataTypeTopic.Record,
            tags: [],
            children: [
              {
                name: 'first_name',
                dataType: DataTypeTopic.String,
                description: 'Description for schema field first_name',
                tags: [],
              },
              {
                name: 'last_name',
                dataType: DataTypeTopic.String,
                tags: [],
              },
            ],
          },
          {
            name: 'age',
            dataType: DataTypeTopic.Int,
            tags: [],
          },
          {
            name: 'club_name',
            dataType: DataTypeTopic.String,
            tags: [],
          },
        ],
      },
      {
        name: `secondary${uuid()}`,
        dataType: DataTypeTopic.Record,
        tags: [],
        children: [],
      },
    ];

    this.entity = {
      name: topicName,
      displayName: topicName,
      service: this.service.name,
      description: `Description for ${topicName}`,
      messageSchema: {
        schemaText: `{"type":"object","required":["name","age","club_name"],"properties":{"name":{"type":"object","required":["first_name","last_name"],
    "properties":{"first_name":{"type":"string"},"last_name":{"type":"string"}}},"age":{"type":"integer"},"club_name":{"type":"string"}}}`,
        schemaType: 'JSON',
        schemaFields: this.children,
      },
      partitions: 128,
    };

    this.childrenSelectorId = this.children[0]['name'];
  }

  async create(apiContext: APIRequestContext) {
    const { parents, ownedRootPath } = await resolveParents(
      apiContext,
      'messaging',
      { service: this.serviceOverride },
      this.sharedInfraKey
    );
    this.serviceResponseData = parents.service as ResponseDataType;
    this.ownedRootPath = ownedRootPath;
    this.service = { ...this.service, name: this.serviceResponseData.name };
    this.entity.service = this.serviceResponseData.name;

    this.entityResponseData = await createOrFetch(apiContext, {
      label: 'TopicClass.create',
      createPath: '/api/v1/topics',
      fqnSegments: [this.service.name, this.entity.name],
      data: this.entity,
    });

    this.childrenSelectorId =
      this.entityResponseData.messageSchema?.schemaFields?.[0]
        .fullyQualifiedName ?? '';

    return {
      service: this.serviceResponseData,
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
        `/api/v1/topics/name/${this.entityResponseData?.fullyQualifiedName}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );

    this.entityResponseData = await okJson(response, 'TopicClass.patch');

    return {
      entity: this.entityResponseData,
    };
  }

  get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
      ownedRootPath: this.ownedRootPath,
    };
  }

  public set(data: {
    entity: Topic;
    service: ResponseDataType;
    ownedRootPath?: string;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.ownedRootPath = data.ownedRootPath;
    this.entity.name = data.entity.name;
    this.entity.service = data.service.name;
    this.service = { ...this.service, name: data.service.name };
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
      `/api/v1/topics/${this.entityResponseData?.id}`
    );

    return { entity: this.entityResponseData };
  }
}
