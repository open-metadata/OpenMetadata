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

import { StoredProcedure } from '../generated/entity/data/storedProcedure';
import {
  Constraint,
  ConstraintType,
  DatabaseServiceType,
  DataType,
  PartitionIntervalTypes,
  RelationshipType,
  Table,
  TableType,
} from '../generated/entity/data/table';
import i18n from '../utils/i18next/LocalUtil';

export const TABLE_SCROLL_VALUE = { x: 1200 };

export const TABLE_CONSTRAINTS_TYPE_OPTIONS = [
  {
    label: i18n.t('label.entity-key', {
      entity: i18n.t('label.primary'),
    }),
    value: ConstraintType.PrimaryKey,
  },
  {
    label: i18n.t('label.entity-key', {
      entity: i18n.t('label.foreign'),
    }),
    value: ConstraintType.ForeignKey,
  },
  {
    label: i18n.t('label.unique'),
    value: ConstraintType.Unique,
  },
  {
    label: i18n.t('label.entity-key', {
      entity: i18n.t('label.dist'),
    }),
    value: ConstraintType.DistKey,
  },
  {
    label: i18n.t('label.entity-key', {
      entity: i18n.t('label.sort'),
    }),
    value: ConstraintType.SortKey,
  },
];

export const COLUMN_CONSTRAINT_TYPE_OPTIONS = [
  {
    label: i18n.t('label.primary-key'),
    value: Constraint.PrimaryKey,
  },
  {
    label: i18n.t('label.not-null'),
    value: Constraint.NotNull,
  },
  {
    label: i18n.t('label.null'),
    value: Constraint.Null,
  },
  {
    label: i18n.t('label.unique'),
    value: Constraint.Unique,
  },
];

export const RELATIONSHIP_TYPE_OPTION = [
  {
    label: i18n.t('label.one-to-one'),
    value: RelationshipType.OneToOne,
  },
  {
    label: i18n.t('label.one-to-many'),
    value: RelationshipType.OneToMany,
  },
  {
    label: i18n.t('label.many-to-one'),
    value: RelationshipType.ManyToOne,
  },
  {
    label: i18n.t('label.many-to-many'),
    value: RelationshipType.ManyToMany,
  },
];

export const TABLE_DUMMY_DATA: Table = {
  id: 'ab4f893b-c303-43d9-9375-3e620a670b02',
  name: 'raw_product_catalog',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_product_catalog',
  description:
    'This is a raw product catalog table contains the product listing, price, seller etc.. represented in our online DB. ',
  version: 0.2,
  updatedAt: 1688442727895,
  updatedBy: 'admin',
  tableType: TableType.Regular,
  dataProducts: [
    {
      id: 'c9b891b1-5d60-4171-9af0-7fd6d74f8f2b',
      type: 'dataProduct',
      name: 'Design Data product ',
      fullyQualifiedName: 'Design Data product ',
      description: "Here's the description for the Design Data product Name.",
      displayName: 'Design Data product Name',
      href: '#',
    },
  ],
  joins: {
    startDate: new Date(),
    dayCount: 30,
    columnJoins: [
      {
        columnName: 'address_id',
        joinedWith: [
          {
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.dim_address_clean.address_id',
            joinCount: 0,
          },
          {
            fullyQualifiedName:
              'sample_data.ecommerce_db.shopify.dim_address.address_id',
            joinCount: 0,
          },
        ],
      },
    ],
    directTableJoins: [
      {
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
        joinCount: 0,
      },
    ],
  },
  columns: [
    {
      name: 'address_id',
      dataType: DataType.Numeric,
      dataTypeDisplay: 'numeric',
      description: 'Unique identifier for the address.',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address_clean.address_id',
      tags: [],
      ordinalPosition: 1,
    },
    {
      name: 'shop_id',
      dataType: DataType.Numeric,
      dataTypeDisplay: 'numeric',
      description:
        'The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address_clean.shop_id',
      tags: [],
      ordinalPosition: 2,
    },
    {
      name: 'first_name',
      dataType: DataType.Varchar,
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'First name of the customer.',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address_clean.first_name',
      tags: [],
      ordinalPosition: 3,
    },
    {
      name: 'last_name',
      dataType: DataType.Varchar,
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'Last name of the customer.',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address_clean.last_name',
      tags: [],
      ordinalPosition: 4,
    },
    {
      name: 'address',
      dataType: DataType.Varchar,
      dataLength: 500,
      dataTypeDisplay: 'varchar',
      description: 'Clean address test',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address_clean.address',
      tags: [],
      ordinalPosition: 5,
    },
    {
      name: 'company',
      dataType: DataType.Varchar,
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: "The name of the customer's business, if one exists.",
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address_clean.company',
      tags: [],
      ordinalPosition: 7,
    },
    {
      name: 'city',
      dataType: DataType.Varchar,
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'The name of the city. For example, Palo Alto.',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address_clean.city',
      tags: [],
      ordinalPosition: 8,
    },
    {
      name: 'region',
      dataType: DataType.Varchar,
      dataLength: 512,
      dataTypeDisplay: 'varchar',
      description:
        // eslint-disable-next-line max-len
        'The name of the region, such as a province or state, where the customer is located. For example, Ontario or New York. This column is the same as CustomerAddress.province in the Admin API.',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address_clean.region',
      tags: [],
      ordinalPosition: 9,
    },
    {
      name: 'zip',
      dataType: DataType.Varchar,
      dataLength: 10,
      dataTypeDisplay: 'varchar',
      description: 'The ZIP or postal code. For example, 90210.',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address_clean.zip',
      tags: [],
      ordinalPosition: 10,
    },
    {
      name: 'country',
      dataType: DataType.Varchar,
      dataLength: 50,
      dataTypeDisplay: 'varchar',
      description: 'The full name of the country. For example, Canada.',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address_clean.country',
      tags: [],
      ordinalPosition: 11,
    },
    {
      name: 'phone',
      dataType: DataType.Varchar,
      dataLength: 15,
      dataTypeDisplay: 'varchar',
      description: 'The phone number of the customer.',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address_clean.phone',
      tags: [],
      ordinalPosition: 12,
    },
  ],
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
  tableConstraints: [
    {
      constraintType: ConstraintType.ForeignKey,
      columns: ['post_id'],
      referredColumns: ['mysql_sample.default.posts_db.Posts.post_id'],
      relationshipType: RelationshipType.ManyToOne,
    },
    {
      constraintType: ConstraintType.ForeignKey,
      columns: ['user_id'],
      referredColumns: ['mysql_sample.default.posts_db.Users.user_id'],
      relationshipType: RelationshipType.ManyToOne,
    },
  ],
  tablePartition: {
    columns: [
      {
        columnName: 'column1',
        interval: 'hourly',
        intervalType: PartitionIntervalTypes.ColumnValue,
      },
      {
        columnName: 'column2',
        interval: 'daily',
        intervalType: PartitionIntervalTypes.ColumnValue,
      },
      {
        columnName: 'column3',
        interval: 'monthly',
        intervalType: PartitionIntervalTypes.ColumnValue,
      },
    ],
  },
  serviceType: DatabaseServiceType.BigQuery,
  tags: [],
  followers: [],
  deleted: false,
};

export const STORED_PROCEDURE_DUMMY_DATA: StoredProcedure = {
  id: '5f3509ca-c8e5-449a-a7e8-b1c3b96e39e8',
  name: 'calculate_average',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify.calculate_average',
  description: 'Procedure to calculate average',
  storedProcedureCode: {
    // eslint-disable-next-line max-len
    code: 'CREATE OR REPLACE PROCEDURE calculate_average(numbers INT ARRAY) RETURNS FLOAT NOT NULL LANGUAGE SQL AS $$DECLARE sum_val INT = 0;count_val INT = 0;average_val FLOAT;BEGIN\n  FOR num IN ARRAY numbers DO sum_val := sum_val + num;\n  count_val := count_val + 1;\nEND FOR;\nIF count_val = 0 THEN\n  average_val := 0.0;\nELSE\n  average_val := sum_val / count_val;\nEND IF;\nRETURN average_val;\nEND;$$;',
  },
  version: 0.5,
  dataProducts: [],
  updatedAt: 1709544812674,
  updatedBy: 'admin',
  databaseSchema: {
    id: '9f127bdc-d060-4fac-ae7b-c635933fc2e0',
    type: 'databaseSchema',
    name: 'shopify',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
    description:
      'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
    displayName: 'shopify',
    deleted: false,
  },
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
  service: {
    id: '75199480-3d06-4b6f-89d2-e8805ebe8d01',
    type: 'databaseService',
    name: 'sample_data',
    fullyQualifiedName: 'sample_data',
    displayName: 'sample_data',
    deleted: false,
  },
  serviceType: DatabaseServiceType.BigQuery,
  deleted: false,
  owners: [
    {
      id: '50bb97a5-cf0c-4273-930e-b3e802b52ee1',
      type: 'user',
      name: 'aaron.singh2',
      fullyQualifiedName: '"aaron.singh2"',
      displayName: 'Aaron Singh',
      deleted: false,
      inherited: true,
    },
  ],
  followers: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
  tags: [],
  domain: {
    id: '31c2b84e-b87a-4e47-934f-9c5309fbb7c3',
    type: 'domain',
    name: 'Engineering',
    fullyQualifiedName: 'Engineering',
    description: 'Domain related engineering development.',
    displayName: 'Engineering',
    inherited: true,
  },
};
