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
import { SearchIndexServiceClass } from './service/SearchIndexServiceClass';

/**
 * Without `service` the search index sits in the shard's shared searchService.
 * Pass a SearchIndexServiceClass when the test needs its own service — to
 * assert on a unique service name, visit the service page, or mutate it.
 */
export type SearchIndexClassOptions = {
  name?: string;
  service?: SearchIndexServiceClass;
  sharedInfraKey?: string;
};

export class SearchIndexClass extends EntityClass {
  service = new SearchIndexServiceClass().entity;
  private readonly serviceOverride?: SearchIndexServiceClass;
  private readonly searchIndexName: string;

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

  constructor(options: SearchIndexClassOptions = {}) {
    super(EntityTypeEndpoint.SearchIndex);
    this.serviceOverride = options.service;
    this.sharedInfraKey = options.sharedInfraKey;
    if (options.service) {
      this.service = options.service.entity;
    }

    this.searchIndexName = options.name ?? `pw-search-index-${uuid()}`;

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
    this.childrenSelectorId = `${this.service.name}.${this.searchIndexName}.${this.children[0].name}`;
    this.serviceCategory = SERVICE_TYPE.Search;
    this.serviceType = ServiceTypes.SEARCH_SERVICES;
  }

  async create(apiContext: APIRequestContext) {
    const { parents, ownedRootPath } = await resolveParents(
      apiContext,
      'search',
      { service: this.serviceOverride },
      this.sharedInfraKey
    );
    this.serviceResponseData = parents.service as ResponseDataType;
    this.ownedRootPath = ownedRootPath;
    this.service = { ...this.service, name: this.serviceResponseData.name };
    this.entity.service = this.serviceResponseData.name;

    this.entityResponseData = await createOrFetch(apiContext, {
      label: 'SearchIndexClass.create',
      createPath: '/api/v1/searchIndexes',
      fqnSegments: [this.service.name, this.entity.name],
      data: this.entity,
    });

    this.childrenSelectorId =
      this.entityResponseData.fields?.[0]?.fullyQualifiedName ?? '';

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
        `/api/v1/searchIndexes/name/${this.entityResponseData?.fullyQualifiedName}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );
    this.entityResponseData = await okJson(response, 'SearchIndexClass.patch');

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
    entity: SearchIndex;
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
      `/api/v1/searchIndexes/${this.entityResponseData?.id}`
    );

    return { entity: this.entityResponseData };
  }
}
