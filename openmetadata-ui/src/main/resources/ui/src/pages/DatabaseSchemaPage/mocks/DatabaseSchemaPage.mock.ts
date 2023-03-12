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

export const mockSearchQueryData = {
  hits: {
    total: {
      value: 18,
      relation: 'eq',
    },
    hits: [
      {
        _source: {
          id: '0e8ec01e-a57f-4173-8d30-deda453174d0',
          name: 'dim.api/client',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify."dim.api/client"',
          description: 'Description',
          displayName: 'dim.api/client',
        },
      },
      {
        _source: {
          id: '2bcadace-b42b-4f86-b865-72fd1bc0338f',
          name: 'dim.product',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.product"',
          description: 'Description',
          displayName: 'dim.product',
        },
      },
      {
        _source: {
          id: '3a39a1ef-0ef4-44ca-ad01-abe389b69a7c',
          name: 'dim.shop',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.shop"',
          description:
            'This dimension table contains online shop information. This table contains one shop per row.',
          displayName: 'dim.shop',
        },
      },
      {
        _source: {
          id: '06d629d7-6d38-4e57-83d2-c9c4235a7f66',
          name: 'dim_address',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
          description: 'Description',
          displayName: 'dim_address',
        },
      },
      {
        _source: {
          id: 'a3bbcfef-9704-4cc5-b4ab-f5356afb9c79',
          name: 'dim_address_clean',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean',
          description: 'Created from dim_address after a small cleanup.',
          displayName: 'dim_address_clean',
        },
      },
      {
        _source: {
          id: 'a6d06d44-32f0-491a-99e9-5c319dd8ff23',
          name: 'dim_customer',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_customer',
          description: 'Description',
          displayName: 'dim_customer',
        },
      },
      {
        _source: {
          id: '86076923-2365-454c-897f-36be6ca02ef2',
          name: 'dim_location',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_location',
          description: 'Description',
          displayName: 'dim_location',
        },
      },
      {
        _source: {
          id: 'eba81b7a-d086-4daf-ab88-041d4703a2e7',
          name: 'dim_staff',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_staff',
          description: 'Description',
          displayName: 'dim_staff',
        },
      },
      {
        _source: {
          id: 'bc4c7a5f-2964-4582-adb1-2b523d6035b8',
          name: 'fact_line_item',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_line_item',
          description: 'Description',
          displayName: 'fact_line_item',
        },
      },
      {
        _source: {
          id: '833438ab-a267-4331-9f9e-be1d9399bda6',
          name: 'fact_order',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_order',
          description: 'Description',
          displayName: 'fact_order',
        },
      },
    ],
  },
  aggregations: {},
};

export const mockGetFeedCountData = {
  totalCount: 0,
  counts: [],
};

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

export const mockGetAllFeedsData = {
  data: [],
  paging: {
    total: 0,
  },
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

export const mockPostFeedByIdData = {
  id: 'f5d62891-3381-4adc-91dc-0a886b9cd751',
  type: 'Conversation',
  href: 'http://localhost:8585/api/v1/feed/f5d62891-3381-4adc-91dc-0a886b9cd751',
  threadTs: 1670412439695,
  about: '<#E::databaseSchema::sample_data.ecommerce_db.shopify::description>',
  entityId: '06f0c9ef-708a-47e1-a36e-0a2b864c9e5d',
  createdBy: 'admin',
  updatedAt: 1670414002766,
  updatedBy: 'admin',
  resolved: false,
  message: 'Testing Conversation',
  postsCount: 2,
  posts: [
    {
      id: '943f793a-35be-4942-adfe-6b5457f95978',
      message: 'Testing',
      postTs: 1670414002762,
      from: 'admin',
      reactions: [],
    },
  ],
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
