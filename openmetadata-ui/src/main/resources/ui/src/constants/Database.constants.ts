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
    href: 'http://sandbox-beta.open-metadata.org/api/v1/domains/31c2b84e-b87a-4e47-934f-9c5309fbb7c3',
  },
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};

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
