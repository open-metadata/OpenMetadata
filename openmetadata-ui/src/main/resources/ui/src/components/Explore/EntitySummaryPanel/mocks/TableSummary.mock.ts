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
  Table,
  TagSource,
} from '../../../../generated/entity/data/table';

const mockDate = new Date('2023-01-03');

export const mockTableEntityDetails: Table = {
  id: '8dd1f238-6ba0-46c6-a091-7db81f2a6bed',
  name: 'dim.api/client',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.api/client"',
  description:
    'This dimension table contains a row for each channel or app that your customers use to create orders. ',
  displayName: 'dim.api/client',
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
          source: TagSource.Tag,
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
      source: TagSource.Tag,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  ],
  tableQueries: [
    {
      query:
        'select cust.customer_id, fact_order.order_id from dim_customer cust join fact_order on',
      users: [],
      vote: 1,
      checksum: 'ff727cf70d5a7a9810704532f3571b82',
      queryDate: mockDate,
    },
    {
      query:
        'select sale.sale_id, cust.customer_id, fact_order.order_ir from shopify.',
      users: [],
      vote: 1,
      checksum: 'e14e02c387dd8482d10c4ec7d3d4c69a',
      queryDate: mockDate,
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
