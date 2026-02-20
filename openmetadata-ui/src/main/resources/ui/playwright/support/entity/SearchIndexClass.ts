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
  DataType,
  SearchIndex,
  SearchIndexField,
} from '../../../src/generated/entity/data/searchIndex';
import { SERVICE_TYPE } from '../../constant/service';
import { ServiceTypes } from '../../constant/settings';
import { uuid } from '../../utils/common';
import { visitEntityPage } from '../../utils/entity';
import { EntityTypeEndpoint, ResponseDataType } from './Entity.interface';
import { EntityClass } from './EntityClass';

export class SearchIndexClass extends EntityClass {
  service: {
    name: string;
    serviceType: string;
    connection: {
      config: {
        type: string;
        hostPort: string;
        authType: {
          username: string;
          password: string;
        };
        connectionTimeoutSecs: number;
        supportsMetadataExtraction: boolean;
      };
    };
  };
  private readonly searchIndexName: string;
  private readonly fqn: string;

  children: SearchIndexField[];

  entity: {
    name: string;
    displayName: string;
    description: string;
    service: string;
    fields: SearchIndexField[];
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: SearchIndex = {} as SearchIndex;

  constructor(name?: string) {
    super(EntityTypeEndpoint.SearchIndex);

    this.service = {
      name: name ?? `pw-search-service-${uuid()}`,
      serviceType: 'ElasticSearch',
      connection: {
        config: {
          type: 'ElasticSearch',
          hostPort: 'elasticsearch:9200',
          authType: {
            username: 'admin',
            password: 'admin',
          },
          connectionTimeoutSecs: 30,
          supportsMetadataExtraction: true,
        },
      },
    };

    this.searchIndexName = `pw-search-index-${uuid()}`;
    this.fqn = `${this.service.name}.${this.searchIndexName}`;

    this.children = [
      {
        name: `name${uuid()}`,
        dataType: DataType.Text,
        dataTypeDisplay: 'text',
        description: 'Table Entity Name.',
        tags: [],
      },
      {
        name: `databaseSchema${uuid()}`,
        dataType: DataType.Text,
        dataTypeDisplay: 'text',
        description: 'Table Entity Database Schema.',
        tags: [],
      },
      {
        name: `description${uuid()}`,
        dataType: DataType.Text,
        dataTypeDisplay: 'text',
        description: 'Table Entity Description.',
        tags: [],
      },
      {
        name: `columns${uuid()}`,
        dataType: DataType.Nested,
        dataTypeDisplay: 'nested',
        description: 'Table Columns.',
        tags: [],
        children: [
          {
            name: `name${uuid()}`,
            dataType: DataType.Text,
            dataTypeDisplay: 'text',
            description: 'Column Name.',
            tags: [],
            children: [
              {
                name: `child_column${uuid()}`,
                dataType: DataType.Text,
                dataTypeDisplay: 'text',
                description: 'Child Column Name.',
                tags: [],
              },
            ],
          },
          {
            name: `description${uuid()}`,
            dataType: DataType.Text,
            dataTypeDisplay: 'text',
            description: 'Column Description.',
            tags: [],
          },
        ],
      },
    ];

    this.entity = {
      name: this.searchIndexName,
      displayName: this.searchIndexName,
      description: `Description for ${this.searchIndexName}`,
      service: this.service.name,
      fields: this.children,
    };

    this.type = 'SearchIndex';
    this.childrenTabId = 'fields';
    this.childrenSelectorId = `${this.fqn}.${this.children[0].name}`;
    this.serviceCategory = SERVICE_TYPE.Search;
    this.serviceType = ServiceTypes.SEARCH_SERVICES;
  }

  async create(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/searchServices',
      {
        data: this.service,
      }
    );
    const entityResponse = await apiContext.post('/api/v1/searchIndexes', {
      data: this.entity,
    });

    this.serviceResponseData = await serviceResponse.json();
    this.entityResponseData = await entityResponse.json();

    this.childrenSelectorId =
      this.entityResponseData.fields[0].fullyQualifiedName ?? '';

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
      `/api/v1/searchIndexes/name/${this.entityResponseData?.fullyQualifiedName}`,
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

  public set(data: { entity: SearchIndex; service: ResponseDataType }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
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
      `/api/v1/services/searchServices/name/${encodeURIComponent(
        this.serviceResponseData?.fullyQualifiedName ?? ''
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
    };
  }
}
