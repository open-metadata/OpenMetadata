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
  DatabaseSchema,
  DatabaseServiceType,
} from '../generated/entity/data/databaseSchema';

export const MOCK_DATABASE_SCHEMA: DatabaseSchema = {
  id: '37122618-5ac1-4d30-ad44-7a0904a89510',
  name: 'shopify',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
  description:
    'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
  version: 0.1,
  updatedAt: 1701253593171,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/databaseSchemas/37122618-5ac1-4d30-ad44-7a0904a89510',
  service: {
    id: '8521eede-f981-4d1c-a331-ccaefffd3439',
    type: 'databaseService',
    name: 'sample_data',
    fullyQualifiedName: 'sample_data',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/databaseServices/8521eede-f981-4d1c-a331-ccaefffd3439',
  },
  serviceType: DatabaseServiceType.CustomDatabase,
  database: {
    id: '0d7ec386-f341-400a-8ff0-c5491856494c',
    type: 'database',
    name: 'ecommerce_db',
    fullyQualifiedName: 'sample_data.ecommerce_db',
    description:
      'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
    deleted: false,
    href: 'http://localhost:8585/api/v1/databases/0d7ec386-f341-400a-8ff0-c5491856494c',
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
    date: new Date('2023-11-30'),
  },
  tags: [],
  deleted: false,
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};
