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

import { Typography } from 'antd';
import React from 'react';
import {
  Column,
  DataType,
  LabelType,
  State,
  TagSource,
} from '../../generated/entity/data/table';
import { DataTypeTopic, Field } from '../../generated/entity/data/topic';

const { Text } = Typography;

export const mockEntityDataWithoutNesting: Column[] = [
  {
    name: 'api_client_id',
    dataType: DataType.Numeric,
    dataTypeDisplay: 'numeric',
    description:
      'ID of the API client that called the Shopify API. For example, the ID for the online store is 580111.',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify."dim.api/client".api_client_id',
    tags: [
      {
        tagFQN: 'PersonalData.SpecialCategory',
        description:
          'GDPR special category data is personal information of data subjects that is especially sensitive.',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
    ],
    ordinalPosition: 1,
  },
  {
    name: 'title',
    dataType: DataType.Varchar,
    dataLength: 100,
    dataTypeDisplay: 'varchar',
    description:
      'Full name of the app or channel. For example, Point of Sale, Online Store.',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify."dim.api/client".title',
    tags: [],
    ordinalPosition: 2,
  },
];

export const mockEntityDataWithoutNestingResponse = [
  {
    children: [],
    constraint: undefined,
    description:
      'ID of the API client that called the Shopify API. For example, the ID for the online store is 580111.',
    name: 'api_client_id',
    tags: [
      {
        tagFQN: 'PersonalData.SpecialCategory',
        description:
          'GDPR special category data is personal information of data subjects that is especially sensitive.',
        source: 'Tag',
        labelType: 'Manual',
        state: 'Confirmed',
      },
    ],
    title: <Text className="entity-title">api_client_id</Text>,
    type: 'NUMERIC',
  },
  {
    children: [],
    constraint: undefined,
    description:
      'Full name of the app or channel. For example, Point of Sale, Online Store.',
    name: 'title',
    tags: [],
    title: <Text className="entity-title">title</Text>,
    type: 'VARCHAR',
  },
];

export const mockEntityDataWithNesting: Field[] = [
  {
    name: 'Customer',
    dataType: DataTypeTopic.Record,
    fullyQualifiedName: 'sample_kafka.customer_events.Customer',
    tags: [],
    children: [
      {
        name: 'id',
        dataType: DataTypeTopic.String,
        fullyQualifiedName: 'sample_kafka.customer_events.Customer.id',
        tags: [],
      },
      {
        name: 'first_name',
        dataType: DataTypeTopic.String,
        fullyQualifiedName: 'sample_kafka.customer_events.Customer.first_name',
        tags: [],
      },
      {
        name: 'last_name',
        dataType: DataTypeTopic.String,
        fullyQualifiedName: 'sample_kafka.customer_events.Customer.last_name',
        tags: [],
      },
      {
        name: 'email',
        dataType: DataTypeTopic.String,
        fullyQualifiedName: 'sample_kafka.customer_events.Customer.email',
        tags: [],
      },
      {
        name: 'address_line_1',
        dataType: DataTypeTopic.String,
        fullyQualifiedName:
          'sample_kafka.customer_events.Customer.address_line_1',
        tags: [],
      },
      {
        name: 'address_line_2',
        dataType: DataTypeTopic.String,
        fullyQualifiedName:
          'sample_kafka.customer_events.Customer.address_line_2',
        tags: [],
      },
      {
        name: 'post_code',
        dataType: DataTypeTopic.String,
        fullyQualifiedName: 'sample_kafka.customer_events.Customer.post_code',
        tags: [],
      },
      {
        name: 'country',
        dataType: DataTypeTopic.String,
        fullyQualifiedName: 'sample_kafka.customer_events.Customer.country',
        tags: [],
      },
    ],
  },
];

export const mockEntityDataWithNestingResponse = [
  {
    children: [
      {
        children: [],
        description: undefined,
        name: 'id',
        tags: [],
        title: <Text className="entity-title">id</Text>,
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'first_name',
        tags: [],
        title: <Text className="entity-title">first_name</Text>,
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'last_name',
        tags: [],
        title: <Text className="entity-title">last_name</Text>,
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'email',
        tags: [],
        title: <Text className="entity-title">email</Text>,
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'address_line_1',
        tags: [],
        title: <Text className="entity-title">address_line_1</Text>,
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'address_line_2',
        tags: [],
        title: <Text className="entity-title">address_line_2</Text>,
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'post_code',
        tags: [],
        title: <Text className="entity-title">post_code</Text>,
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'country',
        tags: [],
        title: <Text className="entity-title">country</Text>,
        type: 'STRING',
      },
    ],
    description: undefined,
    name: 'Customer',
    tags: [],
    title: <Text className="entity-title">Customer</Text>,
    type: 'RECORD',
  },
];

export const mockInvalidDataResponse = [
  {
    children: [],
    constraints: undefined,
    description: undefined,
    name: undefined,
    tags: undefined,
    title: <Text className="entity-title" />,
    type: undefined,
  },
];
