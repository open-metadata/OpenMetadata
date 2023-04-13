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
export const CONTAINER_DATA = {
  id: '5d11e32a-8673-4a84-a9be-ccd9651ba9fc',
  name: 'transactions',
  fullyQualifiedName: 's3_storage_sample.transactions',
  displayName: 'Company Transactions',
  description: "Bucket containing all the company's transactions",
  version: 0.7,
  updatedAt: 1679567030351,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/containers/5d11e32a-8673-4a84-a9be-ccd9651ba9fc',
  owner: {
    id: '28b43857-288b-4e4e-8fac-c9cd34e06393',
    type: 'team',
    name: 'Applications',
    fullyQualifiedName: 'Applications',
    deleted: false,
    href: 'http://localhost:8585/api/v1/teams/28b43857-288b-4e4e-8fac-c9cd34e06393',
  },
  service: {
    id: 'cbc2a5e8-b7d3-4140-9a44-a4b331e5372f',
    type: 'storageService',
    name: 's3_storage_sample',
    fullyQualifiedName: 's3_storage_sample',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/storageServices/cbc2a5e8-b7d3-4140-9a44-a4b331e5372f',
  },
  dataModel: {
    isPartitioned: true,
    columns: [
      {
        name: 'transaction_id',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        description:
          'The ID of the executed transaction. This column is the primary key for this table.',
        fullyQualifiedName: 's3_storage_sample.transactions.transaction_id',
        tags: [],
        constraint: 'PRIMARY_KEY',
        ordinalPosition: 1,
      },
      {
        name: 'merchant',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'The merchant for this transaction.',
        fullyQualifiedName: 's3_storage_sample.transactions.merchant',
        tags: [],
        ordinalPosition: 2,
      },
      {
        name: 'transaction_time',
        dataType: 'TIMESTAMP',
        dataTypeDisplay: 'timestamp',
        description: 'The time the transaction took place.',
        fullyQualifiedName: 's3_storage_sample.transactions.transaction_time',
        tags: [],
        ordinalPosition: 3,
      },
    ],
  },
  prefix: '/transactions/',
  numberOfObjects: 50,
  size: 102400,
  fileFormats: ['parquet'],
  serviceType: 'S3',
  followers: [],
  tags: [
    {
      tagFQN: 'Tier.Tier5',
      description: '',
      source: 'Classification',
      labelType: 'Manual',
      state: 'Confirmed',
    },
  ],
  deleted: false,
};
