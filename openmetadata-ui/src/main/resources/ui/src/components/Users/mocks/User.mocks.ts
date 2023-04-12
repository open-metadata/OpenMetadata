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

import { SearchedDataProps } from 'components/searched-data/SearchedData.interface';
import { SearchIndex } from 'enums/search.enum';
import { DashboardServiceType } from 'generated/entity/data/dashboard';
import {
  DashboardSearchSource,
  PipelineSearchSource,
  TableSearchSource,
  TopicSearchSource,
} from 'interface/search.interface';

export const mockUserData = {
  id: 'd6764107-e8b4-4748-b256-c86fecc66064',
  name: 'xyz',
  displayName: 'XYZ',
  version: 0.1,
  updatedAt: 1648704499857,
  updatedBy: 'xyz',
  email: 'xyz@gmail.com',
  href: 'http://localhost:8585/api/v1/users/d6764107-e8b4-4748-b256-c86fecc66064',
  isAdmin: false,
  profile: {
    images: {
      image512:
        'https://lh3.googleusercontent.com/a-/AOh14Gh8NPux8jEPIuyPWOxAB1od9fGN188Kcp5HeXgc=s512-c',
    },
  },
  teams: [
    {
      id: '3362fe18-05ad-4457-9632-84f22887dda6',
      type: 'team',
      name: 'Finance',
      description: 'This is Finance description.',
      displayName: 'Finance',
      deleted: false,
      href: 'http://localhost:8585/api/v1/teams/3362fe18-05ad-4457-9632-84f22887dda6',
    },
    {
      id: '5069ddd4-d47e-4b2c-a4c4-4c849b97b7f9',
      type: 'team',
      name: 'Data_Platform',
      description: 'This is Data_Platform description.',
      displayName: 'Data_Platform',
      deleted: false,
      href: 'http://localhost:8585/api/v1/teams/5069ddd4-d47e-4b2c-a4c4-4c849b97b7f9',
    },
    {
      id: '7182cc43-aebc-419d-9452-ddbe2fc4e640',
      type: 'team',
      name: 'Customer_Support',
      description: 'This is Customer_Support description.',
      displayName: 'Customer_Support',
      deleted: true,
      href: 'http://localhost:8585/api/v1/teams/7182cc43-aebc-419d-9452-ddbe2fc4e640',
    },
  ],
  owns: [],
  follows: [],
  deleted: false,
  roles: [
    {
      id: 'ce4df2a5-aaf5-4580-8556-254f42574aa7',
      type: 'role',
      name: 'DataConsumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      displayName: 'Data Consumer',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/ce4df2a5-aaf5-4580-8556-254f42574aa7',
    },
  ],
  inheritedRoles: [
    {
      id: '3fa30148-72f6-4205-8cab-56696cc23440',
      type: 'role',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      displayName: 'Data Consumer',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/3fa30148-72f6-4205-8cab-56696cc23440',
    },
  ],
};

export const mockTeamsData = {
  data: [
    {
      id: '28aebba3-9399-46b5-af3a-7fcd852bbec9',
      teamType: 'Group',
      name: 'Cloud_Infra',
      fullyQualifiedName: 'Cloud_Infra',
      displayName: 'Cloud_Infra',
      description: 'This is Cloud_Infra description.',
      version: 0.3,
      updatedAt: 1664444252977,
      updatedBy: 'bharatdussa',
      href: 'http://localhost:8585/api/v1/teams/28aebba3-9399-46b5-af3a-7fcd852bbec9',
      childrenCount: 0,
      userCount: 18,
      isJoinable: true,
      changeDescription: {
        fieldsAdded: [],
        fieldsUpdated: [
          { name: 'teamType', oldValue: 'Department', newValue: 'Group' },
        ],
        fieldsDeleted: [],
        previousVersion: 0.2,
      },
      deleted: false,
      defaultRoles: [],
      inheritedRoles: [
        {
          id: '3ed7b995-ce8b-4720-9beb-6f4a9c626920',
          type: 'role',
          name: 'DataConsumer',
          fullyQualifiedName: 'DataConsumer',
          description:
            'Users with Data Consumer role use different data assets for their day to day work.',
          displayName: 'Data Consumer',
          deleted: false,
          href: 'http://localhost:8585/api/v1/roles/3ed7b995-ce8b-4720-9beb-6f4a9c626920',
        },
      ],
    },
    {
      id: 'd03d909c-fad6-4d71-b9b4-797187b69f80',
      teamType: 'Department',
      name: 'Customer_Support',
      fullyQualifiedName: 'Customer_Support',
      displayName: 'Customer_Support',
      description: 'This is Customer_Support description.',
      version: 0.1,
      updatedAt: 1663830444887,
      updatedBy: 'anonymous',
      href: 'http://localhost:8585/api/v1/teams/d03d909c-fad6-4d71-b9b4-797187b69f80',
      childrenCount: 1,
      userCount: 22,
      isJoinable: true,
      deleted: false,
      defaultRoles: [],
      inheritedRoles: [
        {
          id: '3ed7b995-ce8b-4720-9beb-6f4a9c626920',
          type: 'role',
          name: 'DataConsumer',
          fullyQualifiedName: 'DataConsumer',
          description:
            'Users with Data Consumer role use different data assets for their day to day work.',
          displayName: 'Data Consumer',
          deleted: false,
          href: 'http://localhost:8585/api/v1/roles/3ed7b995-ce8b-4720-9beb-6f4a9c626920',
        },
      ],
    },
    {
      id: '3f188b91-049f-44e5-8d12-b11047ddfcbc',
      teamType: 'Group',
      name: 'Data_Platform',
      fullyQualifiedName: 'Data_Platform',
      displayName: 'Data_Platform',
      description: 'This is Data_Platform description.',
      version: 0.2,
      updatedAt: 1664444283179,
      updatedBy: 'bharatdussa',
      href: 'http://localhost:8585/api/v1/teams/3f188b91-049f-44e5-8d12-b11047ddfcbc',
      childrenCount: 0,
      userCount: 17,
      isJoinable: true,
      changeDescription: {
        fieldsAdded: [],
        fieldsUpdated: [
          { name: 'teamType', oldValue: 'Department', newValue: 'Group' },
        ],
        fieldsDeleted: [],
        previousVersion: 0.1,
      },
      deleted: false,
      defaultRoles: [],
      inheritedRoles: [
        {
          id: '3ed7b995-ce8b-4720-9beb-6f4a9c626920',
          type: 'role',
          name: 'DataConsumer',
          fullyQualifiedName: 'DataConsumer',
          description:
            'Users with Data Consumer role use different data assets for their day to day work.',
          displayName: 'Data Consumer',
          deleted: false,
          href: 'http://localhost:8585/api/v1/roles/3ed7b995-ce8b-4720-9beb-6f4a9c626920',
        },
      ],
    },
  ],
  paging: { total: 7 },
};

export const mockUserRole = {
  data: [
    {
      id: '3ed7b995-ce8b-4720-9beb-6f4a9c626920',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      displayName: 'Data Consumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      version: 0.1,
      updatedAt: 1663825430544,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/roles/3ed7b995-ce8b-4720-9beb-6f4a9c626920',
      allowDelete: false,
      deleted: false,
    },
  ],
  paging: {
    total: 1,
  },
};

export const mockEntityData: {
  data: SearchedDataProps['data'];
  total: number;
  currPage: number;
} = {
  data: [
    {
      _index: SearchIndex.TABLE,
      _type: '_doc',
      _id: 'e81d60d1-d75f-4e4a-834c-8a25900299de',
      _score: 1.980943,
      _source: {
        entityType: 'table',
        id: 'e81d60d1-d75f-4e4a-834c-8a25900299de',
        name: 'raw_customer',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_customer',
        description:
          // eslint-disable-next-line max-len
          'This is a raw customers table as represented in our online DB. This contains personal, shipping and billing addresses and details of the customer store and customer profile. This table is used to build our dimensional and fact tables',
        displayName: 'raw_customer',
        version: 0.7,
        updatedAt: 1681241380852,
        updatedBy: 'admin',
        href: 'http://localhost:8585/api/v1/tables/e81d60d1-d75f-4e4a-834c-8a25900299de',
        columns: [
          {
            dataLength: 1,
            dataType: 'STRING',
            name: 'comments',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_customer.comments',
            ordinalPosition: 1,
            dataTypeDisplay: 'string',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'STRING',
            name: 'creditcard',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_customer.creditcard',
            ordinalPosition: 2,
            dataTypeDisplay: 'string',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'STRING',
            name: 'membership',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_customer.membership',
            ordinalPosition: 4,
            dataTypeDisplay: 'string',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'ARRAY',
            name: 'orders',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_customer.orders',
            ordinalPosition: 5,
            dataTypeDisplay:
              'array<struct<product_id:character varying(24),price:int,onsale:boolean,tax:int,weight:int,others:int,vendor:character varying(64)>>',
            arrayDataType: 'STRUCT',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'STRING',
            name: 'platform',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_customer.platform',
            ordinalPosition: 6,
            dataTypeDisplay: 'string',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'MAP',
            name: 'preference',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_customer.preference',
            ordinalPosition: 7,
            dataTypeDisplay: 'map<character varying(32),boolean>',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'ARRAY',
            name: 'shipping_address',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_customer.shipping_address',
            ordinalPosition: 8,
            dataTypeDisplay:
              'array<struct<name:character varying(32),street_address:character varying(128),city:character varying(32),postcode:character varying(8)>>',
            arrayDataType: 'STRUCT',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'STRING',
            name: 'shipping_date',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_customer.shipping_date',
            ordinalPosition: 9,
            dataTypeDisplay: 'string',
            tags: [],
          },
          {
            dataLength: 1,
            dataType: 'STRING',
            name: 'transaction_date',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_customer.transaction_date',
            ordinalPosition: 10,
            dataTypeDisplay: 'string',
            tags: [],
          },
          {
            children: [
              {
                dataLength: 32,
                dataType: 'VARCHAR',
                name: 'username',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_customer.customer.username',
                dataTypeDisplay: 'character varying(32)',
                tags: [],
              },
              {
                dataLength: 32,
                dataType: 'VARCHAR',
                name: 'name',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_customer.customer.name',
                dataTypeDisplay: 'character varying(32)',
                tags: [],
              },
              {
                dataLength: 1,
                dataType: 'CHAR',
                name: 'sex',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_customer.customer.sex',
                dataTypeDisplay: 'char(1)',
                tags: [],
              },
              {
                dataLength: 128,
                dataType: 'VARCHAR',
                name: 'address',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_customer.customer.address',
                dataTypeDisplay: 'character varying(128)',
                tags: [],
              },
              {
                dataLength: 64,
                dataType: 'VARCHAR',
                name: 'mail',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_customer.customer.mail',
                dataTypeDisplay: 'character varying(64)',
                tags: [],
              },
              {
                dataLength: 16,
                dataType: 'VARCHAR',
                name: 'birthdate',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_customer.customer.birthdate',
                dataTypeDisplay: 'character varying(16)',
                tags: [],
              },
            ],
            dataLength: 1,
            dataType: 'STRUCT',
            name: 'customer',
            constraint: 'NULL',
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.raw_customer.customer',
            ordinalPosition: 3,
            dataTypeDisplay:
              'struct<username:character varying(32),name:character varying(32),sex:char(1),address:character varying(128),mail:character varying(64),birthdate:character varying(16)>',
            tags: [],
          },
        ],
        databaseSchema: {
          deleted: false,
          name: 'shopify',
          description:
            'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
          id: '101dab88-0c46-4f2a-aa20-6f161fafc8af',
          href: 'http://localhost:8585/api/v1/databaseSchemas/101dab88-0c46-4f2a-aa20-6f161fafc8af',
          type: 'databaseSchema',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
        },
        database: {
          deleted: false,
          name: 'ecommerce_db',
          description:
            'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
          id: '72fb2566-045c-424c-a500-c7c3bd123470',
          href: 'http://localhost:8585/api/v1/databases/72fb2566-045c-424c-a500-c7c3bd123470',
          type: 'database',
          fullyQualifiedName: 'sample_data.ecommerce_db',
        },
        service: {
          deleted: false,
          name: 'sample_data',
          id: '68683e52-b326-48c6-ae42-9e3d36cb87f5',
          href: 'http://localhost:8585/api/v1/services/databaseServices/68683e52-b326-48c6-ae42-9e3d36cb87f5',
          type: 'databaseService',
          fullyQualifiedName: 'sample_data',
        },
        owner: {
          deleted: false,
          name: 'admin',
          id: '78cb13de-b6b6-46ad-9b69-3cf6bd637186',
          href: 'http://localhost:8585/api/v1/users/78cb13de-b6b6-46ad-9b69-3cf6bd637186',
          type: 'user',
          fullyQualifiedName: 'admin',
        },
        location: null,
        usageSummary: {
          dailyStats: {
            count: 10,
            percentileRank: 86,
          },
          weeklyStats: {
            count: 70,
            percentileRank: 86,
          },
          monthlyStats: {
            count: 90,
            percentileRank: 86,
          },
          date: '2023-04-11',
        },
        deleted: false,
        serviceType: 'BigQuery',
        tags: [
          {
            tagFQN: 'test 1.term 1',
            labelType: 'Manual',
            description: 'asd',
            source: 'Glossary',
            state: 'Confirmed',
          },
        ],
        tier: null,
        followers: [],
        suggest: [
          {
            input: 'sample_data.ecommerce_db.shopify.raw_customer',
            weight: 5,
          },
          {
            input: 'raw_customer',
            weight: 10,
          },
          {
            input: 'ecommerce_db.shopify.raw_customer',
            weight: 5,
          },
          {
            input: 'shopify.raw_customer',
            weight: 5,
          },
        ],
        column_suggest: [
          {
            input: 'comments',
            weight: 5,
          },
          {
            input: 'creditcard',
            weight: 5,
          },
          {
            input: 'membership',
            weight: 5,
          },
          {
            input: 'orders',
            weight: 5,
          },
          {
            input: 'platform',
            weight: 5,
          },
          {
            input: 'preference',
            weight: 5,
          },
          {
            input: 'shipping_address',
            weight: 5,
          },
          {
            input: 'shipping_date',
            weight: 5,
          },
          {
            input: 'transaction_date',
            weight: 5,
          },
          {
            input: 'customer',
            weight: 5,
          },
          {
            input: 'customer.username',
            weight: 5,
          },
          {
            input: 'customer.name',
            weight: 5,
          },
          {
            input: 'customer.sex',
            weight: 5,
          },
          {
            input: 'customer.address',
            weight: 5,
          },
          {
            input: 'customer.mail',
            weight: 5,
          },
          {
            input: 'customer.birthdate',
            weight: 5,
          },
        ],
        database_suggest: [
          {
            input: 'ecommerce_db',
            weight: 5,
          },
        ],
        schema_suggest: [
          {
            input: 'shopify',
            weight: 5,
          },
        ],
        service_suggest: [
          {
            input: 'sample_data',
            weight: 5,
          },
        ],
        doc_as_upsert: true,
        tableType: 'Regular',
      } as unknown as TableSearchSource,
    },
    {
      _index: SearchIndex.TOPIC,
      _type: '_doc',
      _id: '912fc547-3e86-4189-9e10-d63b175065d6',
      _score: 1.7323679,
      _source: {
        entityType: 'topic',
        id: '912fc547-3e86-4189-9e10-d63b175065d6',
        name: 'avro_record',
        displayName: 'avro_record',
        fullyQualifiedName: 'sample_kafka.avro_record',
        description:
          'All Avro record related events gets captured in this topic',
        version: 0.3,
        updatedAt: 1681241392829,
        updatedBy: 'admin',
        href: 'http://localhost:8585/api/v1/topics/912fc547-3e86-4189-9e10-d63b175065d6',
        deleted: false,
        service: {
          deleted: false,
          name: 'sample_kafka',
          id: 'd22e3c89-c4e6-46f0-a816-3bdac2530777',
          href: 'http://localhost:8585/api/v1/services/messagingServices/d22e3c89-c4e6-46f0-a816-3bdac2530777',
          type: 'messagingService',
          fullyQualifiedName: 'sample_kafka',
        },
        serviceType: 'Kafka',
        schemaText: '{}',
        schemaType: 'Avro',
        cleanupPolicies: ['compact', 'delete'],
        replicationFactor: 4,
        maximumMessageSize: 249,
        retentionSize: 1931232624,
        suggest: [
          {
            input: 'sample_kafka.avro_record',
            weight: 5,
          },
          {
            input: 'avro_record',
            weight: 10,
          },
        ],
        service_suggest: [
          {
            input: 'sample_kafka',
            weight: 5,
          },
        ],
        tags: [
          {
            tagFQN: 'test 1.term 1',
            labelType: 'Manual',
            description: 'asd',
            source: 'Glossary',
            state: 'Confirmed',
          },
        ],
        tier: null,
        owner: {
          deleted: false,
          name: 'admin',
          id: '78cb13de-b6b6-46ad-9b69-3cf6bd637186',
          href: 'http://localhost:8585/api/v1/users/78cb13de-b6b6-46ad-9b69-3cf6bd637186',
          type: 'user',
          fullyQualifiedName: 'admin',
        },
        followers: [],
        doc_as_upsert: true,
        partitions: 128,
        messageSchema: {
          schemaFields: [
            {
              children: [
                {
                  dataType: 'INT',
                  name: 'uid',
                  description: 'The field represents unique id',
                  fullyQualifiedName: 'sample_kafka.avro_record.level.uid',
                  dataTypeDisplay: 'int',
                  tags: [],
                },
                {
                  dataType: 'STRING',
                  name: 'somefield',
                  fullyQualifiedName:
                    'sample_kafka.avro_record.level.somefield',
                  dataTypeDisplay: 'string',
                  tags: [],
                },
                {
                  children: [
                    {
                      children: [
                        {
                          dataType: 'STRING',
                          name: 'item1_lvl2',
                          fullyQualifiedName:
                            'sample_kafka.avro_record.level.options.lvl2_record.item1_lvl2',
                          dataTypeDisplay: 'string',
                          tags: [],
                        },
                        {
                          children: [
                            {
                              children: [
                                {
                                  dataType: 'STRING',
                                  name: 'item1_lvl3',
                                  description:
                                    'The field represents level3 item',
                                  fullyQualifiedName:
                                    'sample_kafka.avro_record.level.options.lvl2_record.item2_lvl2.lvl3_record.item1_lvl3',
                                  dataTypeDisplay: 'string',
                                  tags: [],
                                },
                                {
                                  dataType: 'STRING',
                                  name: 'item2_lvl3',
                                  fullyQualifiedName:
                                    'sample_kafka.avro_record.level.options.lvl2_record.item2_lvl2.lvl3_record.item2_lvl3',
                                  dataTypeDisplay: 'string',
                                  tags: [],
                                },
                              ],
                              dataType: 'RECORD',
                              name: 'lvl3_record',
                              fullyQualifiedName:
                                'sample_kafka.avro_record.level.options.lvl2_record.item2_lvl2.lvl3_record',
                              tags: [],
                            },
                          ],
                          dataType: 'ARRAY',
                          name: 'item2_lvl2',
                          fullyQualifiedName:
                            'sample_kafka.avro_record.level.options.lvl2_record.item2_lvl2',
                          dataTypeDisplay: 'ARRAY<record>',
                          tags: [],
                        },
                      ],
                      dataType: 'RECORD',
                      name: 'lvl2_record',
                      description: 'The field represents a level 2 record',
                      fullyQualifiedName:
                        'sample_kafka.avro_record.level.options.lvl2_record',
                      tags: [],
                    },
                  ],
                  dataType: 'ARRAY',
                  name: 'options',
                  description: 'The field represents options array',
                  fullyQualifiedName: 'sample_kafka.avro_record.level.options',
                  dataTypeDisplay: 'ARRAY<record>',
                  tags: [],
                },
              ],
              dataType: 'RECORD',
              name: 'level',
              description: 'This is a first level record',
              fullyQualifiedName: 'sample_kafka.avro_record.level',
              tags: [],
            },
          ],
          schemaType: 'Avro',
          schemaText: '{}',
        },
        field_suggest: [
          {
            input: 'level',
            weight: 5,
          },
          {
            input: 'level.uid',
            weight: 5,
          },
          {
            input: 'level.somefield',
            weight: 5,
          },
          {
            input: 'level.options',
            weight: 5,
          },
          {
            input: 'options.lvl2_record',
            weight: 5,
          },
          {
            input: 'lvl2_record.item1_lvl2',
            weight: 5,
          },
          {
            input: 'lvl2_record.item2_lvl2',
            weight: 5,
          },
          {
            input: 'item2_lvl2.lvl3_record',
            weight: 5,
          },
          {
            input: 'lvl3_record.item1_lvl3',
            weight: 5,
          },
          {
            input: 'lvl3_record.item2_lvl3',
            weight: 5,
          },
        ],
      } as unknown as TopicSearchSource,
    },
    {
      _index: SearchIndex.PIPELINE,
      _type: '_doc',
      _id: '90c4ac9d-969b-4b6c-921f-0cf2700fdfa3',
      _score: 1.3302417,
      _source: {
        entityType: 'pipeline',
        id: '90c4ac9d-969b-4b6c-921f-0cf2700fdfa3',
        name: 'dim_address_etl',
        displayName: 'dim_address etl',
        fullyQualifiedName: 'sample_airflow.dim_address_etl',
        description: 'dim_address ETL pipeline',
        version: 0.2,
        updatedAt: 1681241412012,
        updatedBy: 'admin',
        pipelineUrl: 'http://localhost:8080/tree?dag_id=dim_address_etl',
        tasks: [
          {
            taskType: 'PrestoOperator',
            taskUrl:
              'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=dim_address_task',
            displayName: 'dim_address Task',
            downstreamTasks: ['assert_table_exists'],
            name: 'dim_address_task',
            description:
              'Airflow operator to perform ETL and generate dim_address table',
            fullyQualifiedName:
              'sample_airflow.dim_address_etl.dim_address_task',
          },
          {
            taskType: 'HiveOperator',
            taskUrl:
              'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
            displayName: 'Assert Table Exists',
            downstreamTasks: [],
            name: 'assert_table_exists',
            description: 'Assert if a table exists',
            fullyQualifiedName:
              'sample_airflow.dim_address_etl.assert_table_exists',
          },
        ],
        deleted: false,
        href: 'http://localhost:8585/api/v1/pipelines/90c4ac9d-969b-4b6c-921f-0cf2700fdfa3',
        owner: {
          deleted: false,
          name: 'admin',
          id: '78cb13de-b6b6-46ad-9b69-3cf6bd637186',
          href: 'http://localhost:8585/api/v1/users/78cb13de-b6b6-46ad-9b69-3cf6bd637186',
          type: 'user',
          fullyQualifiedName: 'admin',
        },
        followers: [],
        tags: [],
        tier: null,
        service: {
          deleted: false,
          name: 'sample_airflow',
          id: '0725e637-0b0d-4c9c-9d98-cadbde36e8e8',
          href: 'http://localhost:8585/api/v1/services/pipelineServices/0725e637-0b0d-4c9c-9d98-cadbde36e8e8',
          type: 'pipelineService',
          fullyQualifiedName: 'sample_airflow',
        },
        serviceType: 'Airflow',
        suggest: [
          {
            input: 'sample_airflow.dim_address_etl',
            weight: 5,
          },
          {
            input: 'dim_address etl',
            weight: 10,
          },
        ],
        task_suggest: [
          {
            input: 'dim_address_task',
            weight: 5,
          },
          {
            input: 'assert_table_exists',
            weight: 5,
          },
        ],
        service_suggest: [
          {
            input: 'sample_airflow',
            weight: 5,
          },
        ],
        doc_as_upsert: true,
      } as unknown as PipelineSearchSource,
    },
    {
      _index: SearchIndex.DASHBOARD,
      _type: '_doc',
      _id: 'd2197a56-301a-408e-ae68-e6400302d784',
      _score: 1.3240497,
      _source: {
        entityType: 'dashboard',
        id: 'd2197a56-301a-408e-ae68-e6400302d784',
        name: 'deck.gl Demo',
        displayName: 'deck.gl Demo',
        fullyQualifiedName: 'sample_superset.10',
        description: '',
        version: 0.2,
        updatedAt: 1681241402148,
        updatedBy: 'admin',
        dashboardUrl: 'http://localhost:808/superset/dashboard/deck/',
        charts: [
          {
            deleted: false,
            displayName: '# of Games That Hit 100k in Sales By Release Year',
            name: '114',
            description: '',
            id: 'b8420780-1775-45d5-95f2-235ed6c1841f',
            href: 'http://localhost:8585/api/v1/charts/b8420780-1775-45d5-95f2-235ed6c1841f',
            type: 'chart',
            fullyQualifiedName: 'sample_superset.114',
          },
          {
            deleted: false,
            displayName: 'Are you an ethnic minority in your city?',
            name: '127',
            description: '',
            id: 'd7ffca13-538b-46af-b5bd-d2f08406d86e',
            href: 'http://localhost:8585/api/v1/charts/d7ffca13-538b-46af-b5bd-d2f08406d86e',
            type: 'chart',
            fullyQualifiedName: 'sample_superset.127',
          },
          {
            deleted: false,
            displayName: '% Rural',
            name: '166',
            description: '',
            id: 'a3e79ca0-1a9a-4182-9b3e-3c6d27ca1886',
            href: 'http://localhost:8585/api/v1/charts/a3e79ca0-1a9a-4182-9b3e-3c6d27ca1886',
            type: 'chart',
            fullyQualifiedName: 'sample_superset.166',
          },
        ],
        href: 'http://localhost:8585/api/v1/dashboards/d2197a56-301a-408e-ae68-e6400302d784',
        owner: {
          deleted: false,
          name: 'admin',
          id: '78cb13de-b6b6-46ad-9b69-3cf6bd637186',
          //   href: 'http://localhost:8585/api/v1/users/78cb13de-b6b6-46ad-9b69-3cf6bd637186',
          type: 'user',
          fullyQualifiedName: 'admin',
        },
        followers: [],
        service: {
          deleted: false,
          name: 'sample_superset',
          id: 'af8e05a5-7eea-495f-9a6b-99371e08bee0',
          href: 'http://localhost:8585/api/v1/services/dashboardServices/af8e05a5-7eea-495f-9a6b-99371e08bee0',
          type: 'dashboardService',
          fullyQualifiedName: 'sample_superset',
        },
        serviceType: DashboardServiceType.Superset,
        usageSummary: {
          dailyStats: {
            count: 0,
            percentileRank: 0,
          },
          weeklyStats: {
            count: 0,
            percentileRank: 0,
          },
          monthlyStats: {
            count: 0,
            percentileRank: 0,
          },
          date: new Date(),
        },
        deleted: false,
        tags: [],
        tier: 'Tier.Tier1',
        suggest: [
          {
            input: 'sample_superset.10',
            weight: 5,
          },
          {
            input: 'deck.gl Demo',
            weight: 10,
          },
        ],
        chart_suggest: [
          {
            input: '# of Games That Hit 100k in Sales By Release Year',
            weight: 5,
          },
          {
            input: 'Are you an ethnic minority in your city?',
            weight: 5,
          },
          {
            input: '% Rural',
            weight: 5,
          },
        ],
        data_model_suggest: [],
        service_suggest: [
          {
            input: 'sample_superset',
            weight: 5,
          },
        ],
        doc_as_upsert: true,
        dataModels: [],
      } as unknown as DashboardSearchSource,
    },
  ],
  total: 6,
  currPage: 1,
};
