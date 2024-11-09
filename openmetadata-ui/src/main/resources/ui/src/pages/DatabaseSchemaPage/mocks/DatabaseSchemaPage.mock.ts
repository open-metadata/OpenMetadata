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

export const mockGetDatabaseSchemaDetailsByFQNData = {
  id: '06f0c9ef-708a-47e1-a36e-0a2b864c9e5d',
  name: 'shopify',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
  description:
    'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
  href: 'http://localhost:8585/api/v1/databaseSchemas/06f0c9ef-708a-47e1-a36e-0a2b864c9e5d',
  service: {
    id: '0e736c54-0c2b-41bc-a877-6df3cdb5a2dd',
    type: 'databaseService',
    name: 'sample_data',
    fullyQualifiedName: 'sample_data',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/databaseServices/0e736c54-0c2b-41bc-a877-6df3cdb5a2dd',
  },
  serviceType: 'BigQuery',
  database: {
    id: '2e45b3a0-6cfa-470a-862e-4b89f28965c3',
    type: 'database',
    name: 'ecommerce_db',
    fullyQualifiedName: 'sample_data.ecommerce_db',
    description:
      'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
    deleted: false,
    href: 'http://localhost:8585/api/v1/databases/2e45b3a0-6cfa-470a-862e-4b89f28965c3',
  },
  deleted: false,
};

export const mockPostThreadData = {
  id: 'f5d62891-3381-4adc-91dc-0a886b9cd751',
  type: 'Conversation',
  href: 'http://localhost:8585/api/v1/feed/f5d62891-3381-4adc-91dc-0a886b9cd751',
  threadTs: 1670412439695,
  about: '<#E::databaseSchema::sample_data.ecommerce_db.shopify::description>',
  entityId: '06f0c9ef-708a-47e1-a36e-0a2b864c9e5d',
  createdBy: 'admin',
  updatedAt: 1670412439696,
  updatedBy: 'admin',
  resolved: false,
  message: 'Testing Conversation',
  postsCount: 0,
  posts: [],
  reactions: [],
};

export const mockPatchDatabaseSchemaDetailsData = {
  id: '06f0c9ef-708a-47e1-a36e-0a2b864c9e5d',
  name: 'shopify',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
  description:
    'This **mock** database contains schema related to shopify sales and orders with related dimension tables. updated',
  version: 0.3,
  updatedAt: 1670414195234,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/databaseSchemas/06f0c9ef-708a-47e1-a36e-0a2b864c9e5d',
  service: {
    id: '0e736c54-0c2b-41bc-a877-6df3cdb5a2dd',
    type: 'databaseService',
    name: 'sample_data',
    fullyQualifiedName: 'sample_data',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/databaseServices/0e736c54-0c2b-41bc-a877-6df3cdb5a2dd',
  },
  serviceType: 'BigQuery',
  database: {
    id: '2e45b3a0-6cfa-470a-862e-4b89f28965c3',
    type: 'database',
    name: 'ecommerce_db',
    fullyQualifiedName: 'sample_data.ecommerce_db',
    description:
      'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
    deleted: false,
    href: 'http://localhost:8585/api/v1/databases/2e45b3a0-6cfa-470a-862e-4b89f28965c3',
  },
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'description',
        oldValue:
          'This **mock** database contains schema related to shopify sales and orders with related dimension tables. ',
        newValue:
          'This **mock** database contains schema related to shopify sales and orders with related dimension tables. updated',
      },
    ],
    fieldsDeleted: [],
    previousVersion: 0.2,
  },
  deleted: false,
};

export const mockEntityPermissions = {
  Create: true,
  Delete: true,
  ViewAll: true,
  ViewBasic: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};
