/*
 *  Copyright 2023 Collate.
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
import {
  DatabaseServiceType,
  DataType,
  LabelType,
  State,
  TagSource,
} from '../../generated/entity/data/table';

export const entityWithoutNameAndDescHighlight = {
  id: '8dd1f238-6ba0-46c6-a091-7db81f2a6bed',
  name: 'dim_address',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.api/client"',
  description:
    'This dimension table contains the billing and shipping addresses of customers.',
  displayName: 'dim_address',
  version: 0.2,
  updatedAt: 1672668265493,
  updatedBy: 'admin',
  href: 'http://openmetadata-server:8585/api/v1/tables/8dd1f238-6ba0-46c6-a091-7db81f2a6bed',
  columns: [
    {
      name: 'api_client_id',
      dataType: DataType.Numeric,
      dataTypeDisplay: 'numeric',
      description:
        'ID of the API client that called the Shopify API. For example, the ID for the online store is 580111.',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify."dim.api/client".api_client_id',
      tags: [
        {
          tagFQN: 'PersonalData.SpecialCategory',
          description:
            'GDPR special category data is personal information of data subjects that is especially sensitive.',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ],
      ordinalPosition: 1,
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
    },
  ],
  deleted: false,
  serviceType: DatabaseServiceType.BigQuery,
  tags: [
    {
      tagFQN: 'PersonalData.SpecialCategory',
      description:
        'GDPR special category data is personal information of data subjects that is especially sensitive.',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  ],
  service: {
    id: '0875717c-5855-427c-8dd6-92d4cbfe7c51',
    type: 'databaseService',
    name: 'sample_data',
    fullyQualifiedName: 'sample_data',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/databaseServices/0875717c-5855-427c-8dd6-92d4cbfe7c51',
  },
  usageSummary: {
    dailyStats: {
      count: 0,
      percentileRank: 0,
    },
    weeklyStats: {
      count: 2,
      percentileRank: 0,
    },
    monthlyStats: {
      count: 0,
      percentileRank: 0,
    },
    date: '2023-02-01' as unknown as Date,
  },
  databaseSchema: {
    id: '406d4782-b480-42a4-ab8b-e6fed20f3eef',
    type: 'databaseSchema',
    name: 'shopify',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
    description:
      'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
    deleted: false,
    href: 'http://localhost:8585/api/v1/databaseSchemas/406d4782-b480-42a4-ab8b-e6fed20f3eef',
  },
  database: {
    id: '78a58be0-26a9-4ac8-b515-067db85bbb41',
    type: 'database',
    name: 'ecommerce_db',
    fullyQualifiedName: 'sample_data.ecommerce_db',
    description:
      'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
    deleted: false,
    href: 'http://localhost:8585/api/v1/databases/78a58be0-26a9-4ac8-b515-067db85bbb41',
  },
  followers: [],
};

export const mockHighlights = {
  displayName: ['dim_<span class="text-highlighter">address</span>'],
  description: [
    'This dimension table contains the billing and shipping <span class="text-highlighter">addresses</span> of customers.',
  ],
  'columns.name': [
    '<span class="text-highlighter">address_id</span>',
    '<span class="text-highlighter">address1</span>',
    '<span class="text-highlighter">address2</span>',
  ],
};

export const highlightedEntityDescription = `This dimension table contains the billing and shipping <span class="text-highlighter">addresses</span> of customers.`;

export const highlightedEntityDisplayName = `dim_<span class="text-highlighter">address</span>`;

export const mockText =
  'This is a test description to verify highlightText method.';

export const mockSearchText = 'test';

export const mockHighlightedResult =
  'This is a <span data-highlight="true" class="text-highlighter">test</span> description to verify highlightText method.';

export const mockEntityForDatabase = {
  id: '127463-8374',
  name: 'default',
  fullyQualifiedName: 'mysql_sample.default',
  service: {
    deleted: false,
    displayName: 'mysql_sample',
    fullyQualifiedName: 'mysql_sample',
    id: '48a1a33a-71f9-4eca-9257-4fe3f919d20b',
    name: 'mysql_sample',
    type: 'databaseService',
  },
  serviceType: 'Mysql',
  entityType: 'database',
};

export const mockEntityForDatabaseSchema = {
  id: '996c254d-1646-4d50-8457-10ec10de6bd8',
  name: 'shopify',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
  service: {
    deleted: false,
    displayName: 'sample_data',
    fullyQualifiedName: 'sample_data',
    id: '166e3e84-dc2e-4c4e-bc4b-fe94d1a29bc7',
    name: 'sample_data',
    type: 'databaseService',
  },
  serviceType: 'BigQuery',
  database: {
    deleted: false,
    description:
      'This mock database contains schemas related to shopify sales and orders with related dimension tables.',
    displayName: 'ecommerce_db',
    fullyQualifiedName: 'sample_data.ecommerce_db',
    id: 'ba923994-a1e3-429b-a7ff-ffae33101255',
    name: 'ecommerce_db',
    type: 'database',
  },
  entityType: 'databaseSchema',
};

export const mockUrl = '/services/mockDatabase';
export const mockSettingUrl = '/settings/services/database-services';
export const mockServiceUrl = '/services/mockService';
export const mockDatabaseUrl = '/entity/MockDatabase';
