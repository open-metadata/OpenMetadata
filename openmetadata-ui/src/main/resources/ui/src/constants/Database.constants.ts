/* eslint-disable max-len */
/*
 *  Copyright 2025 Collate.
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
  Database,
  DatabaseServiceType,
} from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Table, TableType } from '../generated/entity/data/table';

export const DATABASE_DUMMY_DATA: Database = {
  id: '77147d45-888b-42dd-a369-8b7ba882dffb',
  name: 'ecommerce_db',
  fullyQualifiedName: 'sample_data.ecommerce_db',
  displayName: '',
  description:
    'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
  dataProducts: [],
  tags: [],
  version: 1.2,
  updatedAt: 1736405710107,
  updatedBy: 'prajwal.p',
  owners: [
    {
      id: '50bb97a5-cf0c-4273-930e-b3e802b52ee1',
      type: 'user',
      name: 'aaron.singh2',
      fullyQualifiedName: '"aaron.singh2"',
      displayName: 'Aaron Singh',
      deleted: false,
    },
  ],
  service: {
    id: '75199480-3d06-4b6f-89d2-e8805ebe8d01',
    type: 'databaseService',
    name: 'sample_data',
    fullyQualifiedName: 'sample_data',
    displayName: 'sample_data',
    deleted: false,
  },
  serviceType: DatabaseServiceType.BigQuery,
  default: false,
  deleted: false,
  domain: {
    id: '31c2b84e-b87a-4e47-934f-9c5309fbb7c3',
    type: 'domain',
    name: 'Engineering',
    fullyQualifiedName: 'Engineering',
    description: 'Domain related engineering development.',
    displayName: 'Engineering',
  },
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};

export const DATABASE_SCHEMAS_DUMMY_DATA: DatabaseSchema[] = [
  {
    id: 'a17d3132-b844-4157-9645-ad543f64217d',
    name: 'shopify',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
    description:
      'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
    version: 0.1,
    updatedAt: 1742103676753,
    updatedBy: 'admin',
    owners: [],
    service: {
      id: 'b4f35a48-0972-4d81-af2b-9082df4e427f',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      displayName: 'sample_data',
      deleted: false,
    },
    serviceType: DatabaseServiceType.BigQuery,
    database: {
      id: '46a43167-fe50-435b-86de-1fd02cfdb879',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      displayName: 'ecommerce_db',
      deleted: false,
    },
    usageSummary: {
      dailyStats: {
        count: 32,
        percentileRank: 0,
      },
      weeklyStats: {
        count: 64,
        percentileRank: 0,
      },
      monthlyStats: {
        count: 64,
        percentileRank: 0,
      },
      date: new Date('2025-03-18'),
    },
    deleted: false,
    sourceUrl: 'https://www.ecommerce-db.com/shopify',
  },
];

export const DATABASE_SCHEMA_DUMMY_DATA: DatabaseSchema = {
  id: '9f127bdc-d060-4fac-ae7b-c635933fc2e0',
  name: 'shopify',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
  description:
    'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
  dataProducts: [],
  version: 1.1,
  updatedAt: 1736405774154,
  updatedBy: 'prajwal.p',
  owners: [
    {
      id: '50bb97a5-cf0c-4273-930e-b3e802b52ee1',
      type: 'user',
      name: 'aaron.singh2',
      fullyQualifiedName: '"aaron.singh2"',
      displayName: 'Aaron Singh',
      deleted: false,
    },
  ],
  service: {
    id: '75199480-3d06-4b6f-89d2-e8805ebe8d01',
    type: 'databaseService',
    name: 'sample_data',
    fullyQualifiedName: 'sample_data',
    displayName: 'sample_data',
    deleted: false,
  },
  serviceType: DatabaseServiceType.BigQuery,
  database: {
    id: '77147d45-888b-42dd-a369-8b7ba882dffb',
    type: 'database',
    name: 'ecommerce_db',
    fullyQualifiedName: 'sample_data.ecommerce_db',
    description:
      'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
    displayName: 'ecommerce_db',
    deleted: false,
  },
  usageSummary: {
    dailyStats: {
      count: 21,
      percentileRank: 0,
    },
    weeklyStats: {
      count: 21,
      percentileRank: 0,
    },
    monthlyStats: {
      count: 21,
      percentileRank: 0,
    },
    date: new Date('2023-11-10'),
  },
  tags: [],
  deleted: false,
  domain: {
    id: '31c2b84e-b87a-4e47-934f-9c5309fbb7c3',
    type: 'domain',
    name: 'Engineering',
    fullyQualifiedName: 'Engineering',
    description: 'Domain related engineering development.',
    displayName: 'Engineering',
  },
  votes: {
    upVotes: 0,
    downVotes: 1,
    upVoters: [],
    downVoters: [
      {
        id: 'f14f17bf-0923-4234-8e73-2dcc051f2adc',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        displayName: 'admin',
        deleted: false,
      },
    ],
  },
};

export const DUMMY_DATABASE_SCHEMA_TABLES_DETAILS: Table[] = [
  {
    id: '56e2399d-b968-4eed-b705-8ff287800e93',
    name: 'dim___reserved__colon____reserved__arrow__address',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.dim___reserved__colon____reserved__arrow__address',
    description:
      'This dimension table contains the billing and shipping addresses of customers. You can join this table with the sales table to generate lists of the billing and shipping addresses. Customers can enter their addresses more than once, so the same address can appear in more than one row in this table. This table contains one row per customer address.',
    version: 0.1,
    updatedAt: 1743682266125,
    updatedBy: 'admin',
    tableType: TableType.Regular,
    columns: [],
    databaseSchema: {
      id: '31a0a37b-f547-4264-835f-45424e417dbd',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      displayName: 'shopify',
      deleted: false,
    },
    database: {
      id: '35a624d9-1355-4226-8664-3e503313301e',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      displayName: 'ecommerce_db',
      deleted: false,
    },
    service: {
      id: 'cda79445-9e98-4e2e-8e73-38a4f0d794c8',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      displayName: 'sample_data',
      deleted: false,
    },
    serviceType: DatabaseServiceType.BigQuery,
    deleted: false,
    sourceUrl: 'http://localhost:8080/dim_::>address',
    processedLineage: false,
  },
  {
    id: '3cc7cd6f-5b31-4d6c-8eae-c05fd2fac51e',
    name: 'dim_address',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
    description:
      'This dimension table contains the billing and shipping addresses of customers. You can join this table with the sales table to generate lists of the billing and shipping addresses. Customers can enter their addresses more than once, so the same address can appear in more than one row in this table. This table contains one row per customer address.',
    version: 0.3,
    updatedAt: 1743727722854,
    updatedBy: 'admin',

    tableType: TableType.Regular,
    columns: [],
    databaseSchema: {
      id: '31a0a37b-f547-4264-835f-45424e417dbd',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      displayName: 'shopify',
      deleted: false,
    },
    database: {
      id: '35a624d9-1355-4226-8664-3e503313301e',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      displayName: 'ecommerce_db',
      deleted: false,
    },
    service: {
      id: 'cda79445-9e98-4e2e-8e73-38a4f0d794c8',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      displayName: 'sample_data',
      deleted: false,
    },
    serviceType: DatabaseServiceType.BigQuery,
    deleted: false,
    sourceUrl: 'http://localhost:8080/dim_address',
    lifeCycle: {
      created: {
        timestamp: 1743724800000,
        accessedBy: {
          id: 'd1b44eb0-03e2-4031-9834-0fd534895e1a',
          type: 'user',
          fullyQualifiedName: 'admin',
        },
      },
    },
    processedLineage: false,
  },
  {
    id: '6be0133e-033e-4582-b779-ed65b8fe9a92',
    name: 'dim_address_clean',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address_clean',
    description: 'Created from dim_address after a small cleanup.',
    version: 0.5,
    updatedAt: 1743741484432,
    updatedBy: 'admin',

    tableType: TableType.View,
    columns: [],
    databaseSchema: {
      id: '31a0a37b-f547-4264-835f-45424e417dbd',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      displayName: 'shopify',
      deleted: false,
    },
    database: {
      id: '35a624d9-1355-4226-8664-3e503313301e',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      displayName: 'ecommerce_db',
      deleted: false,
    },
    service: {
      id: 'cda79445-9e98-4e2e-8e73-38a4f0d794c8',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      displayName: 'sample_data',
      deleted: false,
    },
    serviceType: DatabaseServiceType.BigQuery,

    deleted: false,
    sourceUrl: 'http://localhost:8080/dim_address_clean',
    lifeCycle: {
      created: {
        timestamp: 1743724800000,
        accessedBy: {
          id: 'd1b44eb0-03e2-4031-9834-0fd534895e1a',
          type: 'user',
          fullyQualifiedName: 'admin',
        },
      },
      updated: {
        timestamp: 1738981540085,
        accessedByAProcess: 'Bob',
      },
      accessed: {
        timestamp: 1738981540085,
        accessedByAProcess: 'Charlie',
      },
    },
    processedLineage: false,
  },
  {
    id: 'e5977bd7-9cd8-489c-9fb9-837df00516a3',
    name: 'dim_customer',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_customer',
    description:
      'The dimension table contains data about your customers. The customers table contains one row per customer. It includes historical metrics (such as the total amount that each customer has spent in your store) as well as forward-looking metrics (such as the predicted number of days between future orders and the expected order value in the next 30 days). This table also includes columns that segment customers into various categories (such as new, returning, promising, at risk, dormant, and loyal), which you can use to target marketing activities.',
    version: 0.4,
    updatedAt: 1743733539305,
    updatedBy: 'admin',

    tableType: TableType.Regular,
    columns: [],
    databaseSchema: {
      id: '31a0a37b-f547-4264-835f-45424e417dbd',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      displayName: 'shopify',
      deleted: false,
    },
    database: {
      id: '35a624d9-1355-4226-8664-3e503313301e',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      displayName: 'ecommerce_db',
      deleted: false,
    },
    service: {
      id: 'cda79445-9e98-4e2e-8e73-38a4f0d794c8',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      displayName: 'sample_data',
      deleted: false,
    },
    serviceType: DatabaseServiceType.BigQuery,

    deleted: false,
    sourceUrl: 'http://localhost:8080/dim_customer',
    lifeCycle: {
      created: {
        timestamp: 1743128739254,
        accessedByAProcess: 'Alice',
      },
      updated: {
        timestamp: 1743215139254,
        accessedByAProcess: 'Bob',
      },
      accessed: {
        timestamp: 1743724800000,
      },
    },
    processedLineage: false,
  },
  {
    id: '3ce4008f-a1f9-43a9-b768-94c3261b3ec2',
    name: 'dim_location',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_location',
    description:
      'The dimension table contains metrics about your Shopify POS. This table contains one row per Shopify POS location. You can use this table to generate a list of the Shopify POS locations or you can join the table with the sales table to measure sales performance.',
    version: 0.3,
    updatedAt: 1743733539457,
    updatedBy: 'admin',

    tableType: TableType.Regular,
    columns: [],
    databaseSchema: {
      id: '31a0a37b-f547-4264-835f-45424e417dbd',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      displayName: 'shopify',
      deleted: false,
    },
    database: {
      id: '35a624d9-1355-4226-8664-3e503313301e',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      displayName: 'ecommerce_db',
      deleted: false,
    },
    service: {
      id: 'cda79445-9e98-4e2e-8e73-38a4f0d794c8',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      displayName: 'sample_data',
      deleted: false,
    },
    serviceType: DatabaseServiceType.BigQuery,

    deleted: false,
    sourceUrl: 'http://localhost:8080/dim_location',
    lifeCycle: {
      created: {
        timestamp: 1743387939421,
        accessedBy: {
          id: 'ef635c2e-e2ad-4cbd-bb52-9e58e33b1454',
          type: 'user',
          fullyQualifiedName: 'anthony_wall4',
        },
      },
      updated: {
        timestamp: 1743387939421,
        accessedByAProcess: 'Alice',
      },
      accessed: {
        timestamp: 1743387939421,
        accessedByAProcess: 'David',
      },
    },
    processedLineage: false,
  },
  {
    id: '342708c8-5d87-4337-8861-873852a95cd7',
    name: 'dim_staff',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_staff',
    description:
      'This dimension table contains information about the staff accounts in the store. It contains one row per staff account. Use this table to generate a list of your staff accounts, or join it with the sales, API clients and locations tables to analyze staff performance at Shopify POS locations.',
    version: 0.3,
    updatedAt: 1743733539520,
    updatedBy: 'admin',

    tableType: TableType.Regular,
    columns: [],
    databaseSchema: {
      id: '31a0a37b-f547-4264-835f-45424e417dbd',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      displayName: 'shopify',
      deleted: false,
    },
    database: {
      id: '35a624d9-1355-4226-8664-3e503313301e',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      displayName: 'ecommerce_db',
      deleted: false,
    },
    service: {
      id: 'cda79445-9e98-4e2e-8e73-38a4f0d794c8',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      displayName: 'sample_data',
      deleted: false,
    },
    serviceType: DatabaseServiceType.BigQuery,

    deleted: false,
    sourceUrl: 'http://localhost:8080/dim_staff',
    lifeCycle: {
      created: {
        timestamp: 1743560739487,
        accessedByAProcess: 'Alice',
      },
      updated: {
        timestamp: 1743560739487,
        accessedByAProcess: 'Bob',
      },
      accessed: {
        timestamp: 1743560739487,
        accessedByAProcess: 'Charlie',
      },
    },
    processedLineage: false,
  },
  {
    id: '85925869-62a0-4f91-b028-53f3d101ecac',
    name: 'dim.api/client',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.api/client"',
    description:
      'This dimension table contains a row for each channel or app that your customers use to create orders. Some examples of these include Facebook and Online Store. You can join this table with the sales table to measure channel performance.',
    version: 0.1,
    updatedAt: 1743682268010,
    updatedBy: 'admin',

    tableType: TableType.Regular,
    columns: [],
    databaseSchema: {
      id: '31a0a37b-f547-4264-835f-45424e417dbd',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      displayName: 'shopify',
      deleted: false,
    },
    database: {
      id: '35a624d9-1355-4226-8664-3e503313301e',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      displayName: 'ecommerce_db',
      deleted: false,
    },
    service: {
      id: 'cda79445-9e98-4e2e-8e73-38a4f0d794c8',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      displayName: 'sample_data',
      deleted: false,
    },
    serviceType: DatabaseServiceType.BigQuery,
    deleted: false,
    sourceUrl: 'http://localhost:8080/dim.api/client',
    processedLineage: false,
  },
  {
    id: 'b3077b79-5e31-4c6c-b614-baa08b2c4905',
    name: 'dim.product',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.product"',
    description:
      'This dimension table contains information about each of the products in your store. This table contains one row per product. This table reflects the current state of products in your Shopify admin.',
    version: 0.3,
    updatedAt: 1743733540050,
    updatedBy: 'admin',

    tableType: TableType.Regular,
    columns: [],
    databaseSchema: {
      id: '31a0a37b-f547-4264-835f-45424e417dbd',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      displayName: 'shopify',
      deleted: false,
    },
    database: {
      id: '35a624d9-1355-4226-8664-3e503313301e',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      displayName: 'ecommerce_db',
      deleted: false,
    },
    service: {
      id: 'cda79445-9e98-4e2e-8e73-38a4f0d794c8',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      displayName: 'sample_data',
      deleted: false,
    },
    serviceType: DatabaseServiceType.BigQuery,
    deleted: false,
    sourceUrl: 'http://localhost:8080/dim.product',
    lifeCycle: {
      created: {
        timestamp: 1739413540011,
        accessedByAProcess: 'Alice',
      },
      updated: {
        timestamp: 1739413540011,
        accessedByAProcess: 'Bob',
      },
      accessed: {
        timestamp: 1739499940011,
        accessedByAProcess: 'Charlie',
      },
    },
    processedLineage: false,
  },
  {
    id: '927cd0c9-8de3-4690-b754-d85ba62c4876',
    name: 'dim.product.variant',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify."dim.product.variant"',
    description:
      'This dimension table contains current information about each of the product variants in your store. This table contains one row per product variant.',
    version: 0.3,
    updatedAt: 1743733539605,
    updatedBy: 'admin',

    tableType: TableType.Regular,
    columns: [],
    databaseSchema: {
      id: '31a0a37b-f547-4264-835f-45424e417dbd',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      displayName: 'shopify',
      deleted: false,
    },
    database: {
      id: '35a624d9-1355-4226-8664-3e503313301e',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      displayName: 'ecommerce_db',
      deleted: false,
    },
    service: {
      id: 'cda79445-9e98-4e2e-8e73-38a4f0d794c8',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      displayName: 'sample_data',
      deleted: false,
    },
    serviceType: DatabaseServiceType.BigQuery,
    changeDescription: {
      fieldsAdded: [],
      fieldsUpdated: [
        {
          name: 'lifeCycle',
          oldValue:
            '{"created":{"timestamp":1743250301180,"accessedByAProcess":"Alice"},"updated":{"timestamp":1743336701180,"accessedByAProcess":"Bob"},"accessed":{"timestamp":1743423101180,"accessedByAProcess":"Charlie"}}',
          newValue:
            '{"created":{"timestamp":1743301539583,"accessedByAProcess":"Alice"},"updated":{"timestamp":1743387939583,"accessedByAProcess":"Bob"},"accessed":{"timestamp":1743474339583,"accessedByAProcess":"Charlie"}}',
        },
      ],
      fieldsDeleted: [],
      previousVersion: 0.2,
      changeSummary: {},
    },
    incrementalChangeDescription: {
      fieldsAdded: [],
      fieldsUpdated: [
        {
          name: 'lifeCycle',
          oldValue:
            '{"created":{"timestamp":1743250301180,"accessedByAProcess":"Alice"},"updated":{"timestamp":1743336701180,"accessedByAProcess":"Bob"},"accessed":{"timestamp":1743423101180,"accessedByAProcess":"Charlie"}}',
          newValue:
            '{"created":{"timestamp":1743301539583,"accessedByAProcess":"Alice"},"updated":{"timestamp":1743387939583,"accessedByAProcess":"Bob"},"accessed":{"timestamp":1743474339583,"accessedByAProcess":"Charlie"}}',
        },
      ],
      fieldsDeleted: [],
      previousVersion: 0.2,
      changeSummary: {},
    },
    deleted: false,
    sourceUrl: 'http://localhost:8080/dim.product.variant',
    lifeCycle: {
      created: {
        timestamp: 1743301539583,
        accessedByAProcess: 'Alice',
      },
      updated: {
        timestamp: 1743387939583,
        accessedByAProcess: 'Bob',
      },
      accessed: {
        timestamp: 1743474339583,
        accessedByAProcess: 'Charlie',
      },
    },
    processedLineage: false,
  },
  {
    id: '561ea446-6e47-4d51-843a-31a9b7e16b04',
    name: 'dim.shop',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.shop"',
    description:
      'This dimension table contains online shop information. This table contains one shop per row.',
    version: 0.3,
    updatedAt: 1743733540213,
    updatedBy: 'admin',

    tableType: TableType.Regular,
    columns: [],
    databaseSchema: {
      id: '31a0a37b-f547-4264-835f-45424e417dbd',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      displayName: 'shopify',
      deleted: false,
    },
    database: {
      id: '35a624d9-1355-4226-8664-3e503313301e',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      displayName: 'ecommerce_db',
      deleted: false,
    },
    service: {
      id: 'cda79445-9e98-4e2e-8e73-38a4f0d794c8',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      displayName: 'sample_data',
      deleted: false,
    },
    serviceType: DatabaseServiceType.BigQuery,
    deleted: false,
    sourceUrl: 'http://localhost:8080/dim.shop',
    lifeCycle: {
      created: {
        timestamp: 1737685540191,
        accessedByAProcess: 'Alice',
      },
      updated: {
        timestamp: 1738463140191,
        accessedByAProcess: 'Bob',
      },
      accessed: {
        timestamp: 1738376740191,
        accessedByAProcess: 'Charlie',
      },
    },
    processedLineage: false,
  },
];
