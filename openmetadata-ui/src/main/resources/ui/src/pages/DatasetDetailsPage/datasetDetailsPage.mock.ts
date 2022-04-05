/*
 *  Copyright 2021 Collate
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

/* eslint-disable max-len */
export const mockFollowRes = {
  eventType: 'entityUpdated',
  entityType: 'table',
  entityId: '0730ac72-1c27-432e-99b4-fb05b8da8632',
  entityFullyQualifiedName: 'bigquery_gcp:shopify:dim_address',
  previousVersion: 0.1,
  currentVersion: 0.1,
  userName: 'anonymous',
  timestamp: 1649137233459,
  changeDescription: {
    fieldsAdded: [
      {
        name: 'followers',
        newValue: [
          {
            id: 'ebf24ad4-e231-4fee-aa36-21e181c43d81',
            type: 'user',
            name: 'aaron_johnson0',
            displayName: 'Aaron Johnson',
            deleted: false,
          },
        ],
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 0.1,
  },
};

export const mockUnfollowRes = {
  eventType: 'entityUpdated',
  entityType: 'table',
  entityId: '0730ac72-1c27-432e-99b4-fb05b8da8632',
  entityFullyQualifiedName: 'bigquery_gcp:shopify:dim_address',
  previousVersion: 0.1,
  currentVersion: 0.1,
  userName: 'anonymous',
  timestamp: 1649144698696,
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [],
    fieldsDeleted: [
      {
        name: 'followers',
        oldValue: [
          {
            id: 'ebf24ad4-e231-4fee-aa36-21e181c43d81',
            type: 'user',
            name: 'aaron_johnson0',
            displayName: 'Aaron Johnson',
            deleted: false,
          },
        ],
      },
    ],
    previousVersion: 0.1,
  },
};

export const updateTagRes = {
  id: '0730ac72-1c27-432e-99b4-fb05b8da8632',
  name: 'dim_address',
  fullyQualifiedName: 'bigquery_gcp:shopify:dim_address',
  description:
    'This dimension table contains the billing and shipping addresses of customers. You can join this table with the sales table to generate lists of the billing and shipping addresses. Customers can enter their addresses more than once, so the same address can appear in more than one row in this table. This table contains one row per customer address.',
  version: 0.2,
  updatedAt: 1649145467378,
  updatedBy: 'anonymous',
  href: 'http://localhost:8585/api/v1/tables/0730ac72-1c27-432e-99b4-fb05b8da8632',
  tableType: 'Regular',
  tableTests: [
    {
      id: 'd763341e-22cd-46a6-9c18-d5f8f4721283',
      name: 'dim_staff.tableRowCountToEqual',
      description: 'Rows should always be 100 because of something',
      testCase: {
        config: {
          value: 120,
        },
        tableTestType: 'tableRowCountToEqual',
      },
      executionFrequency: 'Daily',
      results: [
        {
          executionTime: 1646221199,
          testCaseStatus: 'Failed',
          result: 'Found 100.0 rows vs. the expected 120',
        },
        {
          executionTime: 1646220190,
          testCaseStatus: 'Success',
          result: 'Found 120.0 rows vs. the expected 120',
        },
      ],
      updatedAt: 1649048766176,
      updatedBy: 'anonymous',
    },
  ],
  columns: [
    {
      name: 'address_id',
      dataType: 'NUMERIC',
      dataTypeDisplay: 'numeric',
      description: 'Unique identifier for the address.',
      fullyQualifiedName: 'bigquery_gcp:shopify:dim_address:address_id',
      tags: [
        {
          tagFQN: 'PersonalData:Personal',
          source: 'Tag',
          labelType: 'Manual',
          state: 'Confirmed',
        },
      ],
      ordinalPosition: 1,
    },
    {
      name: 'shop_id',
      dataType: 'NUMERIC',
      dataTypeDisplay: 'numeric',
      description:
        'The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
      fullyQualifiedName: 'bigquery_gcp:shopify:dim_address:shop_id',
      tags: [],
      ordinalPosition: 2,
    },
    {
      name: 'first_name',
      dataType: 'VARCHAR',
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'First name of the customer.',
      fullyQualifiedName: 'bigquery_gcp:shopify:dim_address:first_name',
      tags: [],
      ordinalPosition: 3,
    },
    {
      name: 'last_name',
      dataType: 'VARCHAR',
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'Last name of the customer.',
      fullyQualifiedName: 'bigquery_gcp:shopify:dim_address:last_name',
      tags: [],
      ordinalPosition: 4,
    },
    {
      name: 'address1',
      dataType: 'VARCHAR',
      dataLength: 500,
      dataTypeDisplay: 'varchar',
      description: 'The first address line. For example, 150 Elgin St.',
      fullyQualifiedName: 'bigquery_gcp:shopify:dim_address:address1',
      tags: [],
      ordinalPosition: 5,
    },
    {
      name: 'address2',
      dataType: 'VARCHAR',
      dataLength: 500,
      dataTypeDisplay: 'varchar',
      description: 'The second address line. For example, Suite 800.',
      fullyQualifiedName: 'bigquery_gcp:shopify:dim_address:address2',
      tags: [],
      ordinalPosition: 6,
    },
    {
      name: 'company',
      dataType: 'VARCHAR',
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: "The name of the customer's business, if one exists.",
      fullyQualifiedName: 'bigquery_gcp:shopify:dim_address:company',
      tags: [],
      ordinalPosition: 7,
    },
    {
      name: 'city',
      dataType: 'VARCHAR',
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'The name of the city. For example, Palo Alto.',
      fullyQualifiedName: 'bigquery_gcp:shopify:dim_address:city',
      tags: [],
      ordinalPosition: 8,
    },
    {
      name: 'region',
      dataType: 'VARCHAR',
      dataLength: 512,
      dataTypeDisplay: 'varchar',
      description:
        'The name of the region, such as a province or state, where the customer is located. For example, Ontario or New York. This column is the same as CustomerAddress.province in the Admin API.',
      fullyQualifiedName: 'bigquery_gcp:shopify:dim_address:region',
      tags: [],
      ordinalPosition: 9,
    },
    {
      name: 'zip',
      dataType: 'VARCHAR',
      dataLength: 10,
      dataTypeDisplay: 'varchar',
      description: 'The ZIP or postal code. For example, 90210.',
      fullyQualifiedName: 'bigquery_gcp:shopify:dim_address:zip',
      tags: [],
      ordinalPosition: 10,
    },
    {
      name: 'country',
      dataType: 'VARCHAR',
      dataLength: 50,
      dataTypeDisplay: 'varchar',
      description: 'The full name of the country. For example, Canada.',
      fullyQualifiedName: 'bigquery_gcp:shopify:dim_address:country',
      tags: [],
      ordinalPosition: 11,
    },
    {
      name: 'phone',
      dataType: 'VARCHAR',
      dataLength: 15,
      dataTypeDisplay: 'varchar',
      description: 'The phone number of the customer.',
      fullyQualifiedName: 'bigquery_gcp:shopify:dim_address:phone',
      tags: [],
      ordinalPosition: 12,
    },
  ],
  tableConstraints: [
    {
      constraintType: 'PRIMARY_KEY',
      columns: ['address_id', 'shop_id'],
    },
  ],
  database: {
    id: '8726098a-59cc-47d0-af78-8cca124584d2',
    type: 'database',
    name: 'bigquery_gcp:shopify',
    description:
      'This **mock** database contains tables related to shopify sales and orders with related dimension tables.',
    deleted: false,
    href: 'http://localhost:8585/api/v1/databases/8726098a-59cc-47d0-af78-8cca124584d2',
  },
  service: {
    id: 'c866be24-baa4-4ff1-873c-ad018dfbe6e1',
    type: 'databaseService',
    name: 'bigquery_gcp',
    description: '',
    deleted: false,
  },
  serviceType: 'BigQuery',
  tags: [],
  sampleData: {
    columns: ['user_id', 'shop_id', 'first_name', 'last_name', 'email'],
    rows: [
      [
        '5a115c0e-f391-4710-a95f-0ad88ccc7f88',
        'af67bd87-537f-49be-8de8-2909b0dccfee',
        'Raymond',
        'Nicholas',
        'Say peace peace.',
      ],
      [
        '1071d5ae-5f8d-4127-a733-99dd11de25d2',
        '1d4e87a3-6beb-48e4-a878-c03a75f57875',
        'Elizabeth',
        'James',
        'Program rather go.',
      ],
      [
        '46beb027-cf83-4819-a78f-fe1d159d2f89',
        '5dc337ae-5f73-4873-bd8e-4a88ce60194e',
        'Jill',
        'Peggy',
        'Often his fund page.',
      ],
      [
        'bcb6ef92-01df-4936-a7dd-a2aed7a19ed0',
        '088cd1f4-5bb1-455d-a764-c515fe5d3d2b',
        'Juan',
        'Mark',
        'Control contain.',
      ],
      [
        '7b0d1d34-0268-490f-9458-746e9af720c1',
        '4c609b04-c16d-47e2-9648-160da772ed28',
        'Matthew',
        'Hunter',
        'Him TV history.',
      ],
      [
        '550bcf02-ef57-4c14-b02c-c45c84dbc144',
        'fbb3857e-e3a3-4db0-a403-927a4905177e',
        'Donald',
        'Heather',
        'Writer detail often.',
      ],
      [
        '14fd206d-bf3f-4011-883b-56c999ee7bfe',
        '48177436-2bb0-43e4-a0a2-15c801b82db7',
        'Craig',
        'Kristie',
        'Might organization.',
      ],
      [
        '20c22271-e1a7-4076-a1ee-87dc421ef767',
        '1d4ec979-f837-4685-a5aa-cdacae76b8b4',
        'Steven',
        'Kenneth',
        'Lead reveal but.',
      ],
      [
        'd2806695-8993-4da3-8f6f-9f205a9f494c',
        'd8aee504-e8e5-4ce7-bb7a-f99599c29db5',
        'Sarah',
        'Riley',
        'Build statement.',
      ],
      [
        '256faf2d-923c-4cb9-94ef-bb281c108588',
        '6c39e01d-f762-4d08-a44c-c0bcb1c0bb75',
        'Anita',
        'Jeremy',
        'Hospital long.',
      ],
      [
        '7aa67031-4f01-43f8-9f5c-8fc2a85fb00d',
        '3f707384-5ca1-442d-bfdb-1dd96df1b531',
        'Manuel',
        'Stephen',
        'Address tend gas.',
      ],
      [
        'edd0f656-2a72-4946-8049-afdbcb177ca4',
        '0e323531-0ae3-4520-97f2-86fd4894af35',
        'Jerry',
        'Cody',
        'Community wind.',
      ],
      [
        '6472792d-49eb-4da6-b21c-e797b60c5842',
        'ff89c994-8d01-431f-9e44-33ad84259edb',
        'Jared',
        'Kari',
        'Sign medical color.',
      ],
      [
        '3eabd386-6616-4ed0-8e34-40f49fd7a3bf',
        '167885a2-2e71-4b26-976e-e4e99cb9f63d',
        'Sandra',
        'Jeffery',
        'Bar know beyond.',
      ],
      [
        '710b8fb2-ed25-4bf0-aee1-a8017a3f6b73',
        'f69d5f7b-55dc-43d6-bb04-3c3fde491a2b',
        'Randy',
        'Samantha',
        'Red matter measure.',
      ],
      [
        '7cf8961e-2d83-4af8-ad87-b97db04289b6',
        'ade9e289-d929-42de-8099-4da22dd9c3b2',
        'Kevin',
        'John',
        'Manager seat hold.',
      ],
      [
        'fd68c724-0b9b-4f4b-99d8-dadad426600c',
        '7aa91f61-358e-46dd-ab7d-500859c61b6d',
        'Austin',
        'David',
        'Be determine travel.',
      ],
      [
        '77a81aa9-bc0b-4441-b680-cea2eb2a47a0',
        'e93ef096-f856-43a9-b198-d1edbc7f2bab',
        'Jeffrey',
        'Kelly',
        'Thought be light.',
      ],
      [
        '1e847c44-493f-4bfc-b7d6-0a70e0c0c188',
        'e514969c-6118-4a37-8e56-39e0820d5dc0',
        'Kelly',
        'Jacqueline',
        'Page language tree.',
      ],
      [
        '7786d7a8-c39a-4106-8cb5-b0e962c490a5',
        '65ad391c-85ac-4a9c-8157-90276dfee419',
        'Kimberly',
        'Victoria',
        'Environment simply.',
      ],
      [
        '1c2cc040-cc10-4206-9a7f-c16bdcb2f345',
        '458f2c22-b2a2-40f9-8cbc-d9ae24a4a904',
        'Melanie',
        'Christopher',
        'Theory above yet.',
      ],
      [
        '225bce46-ba8a-4cda-acbb-12a246e22d03',
        '7d305f39-9a57-4df4-97d7-510aaf5084d1',
        'Jeremy',
        'Anthony',
        'Condition report.',
      ],
      [
        '4ce2b96a-4311-4499-864c-d065c1502054',
        '246f1a6a-62e3-4068-b5b5-5b4c8e600832',
        'Bruce',
        'Shelby',
        'Thank get shake.',
      ],
      [
        'd2ffd834-e487-4afa-9c1a-ddd2191182cb',
        'c45bee6f-df30-4966-97b7-14d9a1326fe4',
        'Sean',
        'Jennifer',
        'Compare blood store.',
      ],
      [
        'bf84f8d3-5140-4e38-9649-6e0998feefaf',
        '64e750b8-7acf-4632-90fc-4c8e7a856651',
        'Walter',
        'Jessica',
        'Nation medical to.',
      ],
    ],
  },
  changeDescription: {
    fieldsAdded: [
      {
        name: 'columns:address_id:tags',
        newValue:
          '[{"tagFQN":"PersonalData:Personal","source":"Tag","labelType":"Manual","state":"Confirmed"}]',
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 0.1,
  },
  deleted: false,
};

export const createPostRes = {
  id: 'dd5848a6-515b-4c46-8a96-7bae8f50358c',
  href: 'http://localhost:8585/api/v1/feed/dd5848a6-515b-4c46-8a96-7bae8f50358c',
  threadTs: 1649149216727,
  about:
    '<#E/table/bigquery_gcp:shopify:dim_address/columns/address_id/description>',
  entityId: '0730ac72-1c27-432e-99b4-fb05b8da8632',
  createdBy: 'aaron_johnson0',
  updatedAt: 1649149216727,
  updatedBy: 'anonymous',
  resolved: false,
  message: 'test',
  postsCount: 0,
  posts: [],
};

export const mockLineageRes = {
  entity: {
    id: 'efcb5428-0376-4dcd-9348-4e085cde8572',
    type: 'table',
    name: 'bigquery_gcp:shopify:dim_staff',
    description:
      'This dimension table contains information about the staff accounts in the store. It contains one row per staff account. Use this table to generate a list of your staff accounts, or join it with the sales, API clients and locations tables to analyze staff performance at Shopify POS locations.',
    deleted: false,
    href: 'http://localhost:8585/api/v1/tables/efcb5428-0376-4dcd-9348-4e085cde8572',
  },
  nodes: [],
  upstreamEdges: [],
  downstreamEdges: [],
};
