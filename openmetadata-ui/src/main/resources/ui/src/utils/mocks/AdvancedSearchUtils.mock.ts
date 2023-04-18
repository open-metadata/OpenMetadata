/*
 *  Copyright 2022 Collate.
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

import { SearchIndex } from 'enums/search.enum';
import {
  DatabaseServiceType,
  DataType,
  TableType,
} from 'generated/entity/data/table';
import { DataTypeTopic } from 'generated/entity/data/topic';
import { ExploreSearchSource, SuggestOption } from 'interface/search.interface';

export const mockOptionsArray = [
  { key: 'option_1', label: 'option_1' },
  { key: 'option_2', label: 'option_2' },
  { key: 'option_3', label: 'option_3' },
  { key: 'option_4', label: 'option_4' },
];

export const mockShortOptionsArray = [
  { key: 'str1', label: 'str1' },
  { key: 'str2', label: 'str2' },
];

export const mockLongOptionsArray = [
  { key: 'string1', label: 'string1' },
  { key: 'string2', label: 'string2' },
  { key: 'string3', label: 'string3' },
  { key: 'string4', label: 'string4' },
];

export const mockItemLabel = 'Aaron Warren and Aaron Warner';

export const highlightedItemLabel =
  'Aaron <mark>Wa</mark>rren and Aaron <mark>Wa</mark>rner';

export const mockGetServiceOptionData: SuggestOption<
  SearchIndex,
  ExploreSearchSource
> = {
  text: 'sample_data text',
  _index: SearchIndex.TABLE,
  _id: 'a363ad5e-14c9-47ff-8a9e-48aa7731daf5',
  _source: {
    id: 'a363ad5e-14c9-47ff-8a9e-48aa7731daf5',
    name: 'dim.api/client',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.api/client"',
    description: 'This dimension table contains a row for each channel.',
    version: 0.1,
    updatedAt: 1680584064080,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/tables/a363ad5e-14c9-47ff-8a9e-48aa7731daf5',
    tableType: TableType.Regular,
    type: '',
    columns: [
      {
        name: 'api_client_id',
        dataType: DataType.Numeric,
        dataTypeDisplay: 'numeric',
        description:
          'ID of the API client that called the Shopify API. For example, the ID for the online store is 580111.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify."dim.api/client".api_client_id',
        tags: [],
        ordinalPosition: 1,
        customMetrics: [],
      },
      {
        name: 'title',
        dataType: DataType.Varchar,
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description:
          'Full name of the app or channel. For example, Point of Sale, Online Store.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify."dim.api/client".title',
        tags: [],
        ordinalPosition: 2,
        customMetrics: [],
      },
    ],
    databaseSchema: {
      id: '10cb1ad0-9245-42ff-8bbc-fce4bc9a451d',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      deleted: false,
    },
    database: {
      id: 'e45c1989-b970-47e9-9b25-c78938835303',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      deleted: false,
    },
    service: {
      id: '6952b1c3-0518-4f61-9519-a4e39562fe69',
      type: 'databaseService',
      name: 'sample_data',
      displayName: 'sample_data display',
      fullyQualifiedName: 'sample_data',
      description: 'd',
      deleted: false,
    },
    serviceType: DatabaseServiceType.BigQuery,
    tags: [],
    followers: [],
    deleted: false,
    displayName: 'dim.api/client',
    tier: undefined,
    entityType: 'table',
  },
};

export const mockGetServiceOptionDataWithoutDN: SuggestOption<
  SearchIndex,
  ExploreSearchSource
> = {
  ...mockGetServiceOptionData,
  _source: {
    ...mockGetServiceOptionData._source,
    type: '',
    service: {
      id: '6952b1c3-0518-4f61-9519-a4e39562fe69',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      description: 'd',
      deleted: false,
    },
  },
};

export const mockGetServiceOptionDataWithoutNameDN: SuggestOption<
  SearchIndex,
  ExploreSearchSource
> = {
  ...mockGetServiceOptionData,
  _source: {
    ...mockGetServiceOptionData._source,
    type: '',
    service: {
      id: '6952b1c3-0518-4f61-9519-a4e39562fe69',
      type: 'databaseService',
      fullyQualifiedName: 'sample_data',
      description: 'd',
      deleted: false,
    },
  },
};

export const mockGetColumnOptionsData: SuggestOption<
  SearchIndex,
  ExploreSearchSource
> = {
  ...mockGetServiceOptionData,
  text: 'ad_id',
  _source: {
    ...mockGetServiceOptionData,
    type: '',
    entityType: '',
    id: '',
    name: '',
    columns: [
      {
        name: 'ad_id',
        displayName: 'ad_id display',
        dataType: DataType.Numeric,
        dataTypeDisplay: 'numeric',
        description:
          'ID of the API client that called the Shopify API. For example, the ID for the online store is 580111.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify."dim.api/client".api_client_id',
        tags: [],
        ordinalPosition: 1,
        customMetrics: [],
      },
    ],
  },
};

export const mockGetColumnOptionsDataWithoutDN: SuggestOption<
  SearchIndex,
  ExploreSearchSource
> = {
  ...mockGetServiceOptionData,
  text: 'ad_id',
  _source: {
    ...mockGetServiceOptionData,
    type: '',
    entityType: '',
    id: '',
    name: '',
    columns: [
      {
        name: 'ad_id',
        dataType: DataType.Numeric,
        dataTypeDisplay: 'numeric',
        description:
          'ID of the API client that called the Shopify API. For example, the ID for the online store is 580111.',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify."dim.api/client".api_client_id',
        tags: [],
        ordinalPosition: 1,
        customMetrics: [],
      },
    ],
  },
};

export const mockGetSchemaFieldOptionsData: SuggestOption<
  SearchIndex,
  ExploreSearchSource
> = {
  ...mockGetServiceOptionData,
  text: 'AddressBook display',
  _source: {
    ...mockGetServiceOptionData,
    type: '',
    partitions: 2,
    entityType: '',
    id: '',
    name: '',
    service: {
      id: '2',
      type: '',
    },
    messageSchema: {
      schemaFields: [
        {
          name: 'AddressBook',
          displayName: 'AddressBook display',
          dataType: DataTypeTopic.Array,
        },
      ],
    },
  },
};

export const mockGetSchemaFieldOptionsDataWithoutDN: SuggestOption<
  SearchIndex,
  ExploreSearchSource
> = {
  ...mockGetServiceOptionData,
  text: 'AddressBook',
  _source: {
    ...mockGetServiceOptionData,
    type: '',
    partitions: 2,
    entityType: '',
    id: '',
    name: '',
    service: {
      id: '2',
      type: '',
    },
    messageSchema: {
      schemaFields: [
        {
          name: 'AddressBook',
          dataType: DataTypeTopic.Array,
        },
      ],
    },
  },
};

export const mockGetTasksOptionsData: SuggestOption<
  SearchIndex,
  ExploreSearchSource
> = {
  ...mockGetServiceOptionData,
  text: 'task display',
  _source: {
    ...mockGetServiceOptionData,
    type: '',
    partitions: 2,
    entityType: '',
    id: '',
    name: '',
    service: {
      id: '2',
      type: '',
    },
    tasks: [
      {
        name: 'task name',
        displayName: 'task display',
      },
    ],
  },
};

export const mockGetTasksOptionsDataWithoutDN: SuggestOption<
  SearchIndex,
  ExploreSearchSource
> = {
  ...mockGetServiceOptionData,
  text: 'task name',
  _source: {
    ...mockGetServiceOptionData,
    type: '',
    partitions: 2,
    entityType: '',
    id: '',
    name: '',
    service: {
      id: '2',
      type: '',
    },
    tasks: [
      {
        name: 'task name',
      },
    ],
  },
};

export const mockGetChartsOptionsData: SuggestOption<
  SearchIndex,
  ExploreSearchSource
> = {
  ...mockGetServiceOptionData,
  text: 'chart display',
  _source: {
    ...mockGetServiceOptionData,
    type: '',
    partitions: 2,
    entityType: '',
    id: '',
    name: '',
    service: {
      id: '2',
      type: '',
    },
    charts: [
      {
        id: '3',
        name: 'chart name',
        displayName: 'chart display',
        type: '',
      },
    ],
  },
};

export const mockGetChartsOptionsDataWithoutDN: SuggestOption<
  SearchIndex,
  ExploreSearchSource
> = {
  ...mockGetServiceOptionData,
  text: 'chart name',
  _source: {
    ...mockGetServiceOptionData,
    type: '',
    partitions: 2,
    entityType: '',
    id: '',
    name: '',
    service: {
      id: '2',
      type: '',
    },
    charts: [
      {
        id: '3',
        name: 'chart name',
        type: '',
      },
    ],
  },
};

export const mockGetChartsOptionsDataWithoutNameDN: SuggestOption<
  SearchIndex,
  ExploreSearchSource
> = {
  ...mockGetServiceOptionData,
  text: 'chart text',
  _source: {
    ...mockGetServiceOptionData,
    type: '',
    partitions: 2,
    entityType: '',
    id: '',
    name: '',
    service: {
      id: '2',
      type: '',
    },
    charts: [
      {
        id: '3',
        type: '',
      },
    ],
  },
};
