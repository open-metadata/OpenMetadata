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

import { StoredProcedureVersionProp } from '../components/Database/StoredProcedureVersion/StoredProcedureVersion.interface';
import { DatabaseServiceType, TableType } from '../generated/entity/data/table';
import { ENTITY_PERMISSIONS } from '../mocks/Permissions.mock';
import {
  mockBackHandler,
  mockDomain,
  mockOwner,
  mockTier,
  mockVersionHandler,
  mockVersionList,
} from '../mocks/VersionCommon.mock';

const mockData = {
  id: 'ab4f893b-c303-43d9-9375-3e620a670b02',
  name: 'update_dim_address_table',
  fullyQualifiedName:
    'sample_data.ecommerce_db.shopify.update_dim_address_table',
  description:
    'This is a raw product catalog table contains the product listing, price, seller etc.. represented in our online DB. ',
  version: 0.2,
  updatedAt: 1688442727895,
  updatedBy: 'admin',
  tableType: TableType.Regular,
  columns: [],
  owners: [
    {
      id: '38be030f-f817-4712-bc3b-ff7b9b9b805e',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
    },
  ],
  databaseSchema: {
    id: '3f0d9c39-0926-4028-8070-65b0c03556cb',
    type: 'databaseSchema',
    name: 'shopify',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
    description:
      'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
    deleted: false,
  },
  database: {
    id: 'f085e133-e184-47c8-ada5-d7e005d3153b',
    type: 'database',
    name: 'ecommerce_db',
    fullyQualifiedName: 'sample_data.ecommerce_db',
    description:
      'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
    deleted: false,
  },
  service: {
    id: 'e61069a9-29e3-49fa-a7f4-f5227ae50b72',
    type: 'databaseService',
    name: 'sample_data',
    fullyQualifiedName: 'sample_data',
    deleted: false,
  },
  serviceType: DatabaseServiceType.BigQuery,
  tags: [],
  followers: [],
  changeDescription: {
    fieldsAdded: [
      {
        name: 'owner',
        newValue:
          '{"id":"38be030f-f817-4712-bc3b-ff7b9b9b805e","type":"user","name":"aaron_johnson0","fullyQualifiedName":"aaron_johnson0","displayName":"Aaron Johnson","deleted":false}',
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 0.1,
  },
  deleted: false,
  storedProcedureCode: '',
};

export const storedProcedureVersionMockProps: StoredProcedureVersionProp = {
  version: '0.3',
  currentVersionData: mockData,
  isVersionLoading: false,
  owners: mockOwner,
  domains: [mockDomain],
  dataProducts: [],
  tier: mockTier,
  slashedTableName: [],

  versionList: mockVersionList,
  deleted: false,
  backHandler: mockBackHandler,
  versionHandler: mockVersionHandler,
  entityPermissions: ENTITY_PERMISSIONS,
};
