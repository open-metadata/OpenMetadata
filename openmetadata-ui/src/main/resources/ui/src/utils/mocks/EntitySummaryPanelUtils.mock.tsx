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
import { Link } from 'react-router-dom';
import {
  Column,
  DataType,
  LabelType,
  State,
  TagSource,
} from '../../generated/entity/data/table';
import { DataTypeTopic, Field } from '../../generated/entity/data/topic';
import { ReactComponent as IconExternalLink } from '../assets/svg/external-links.svg';

const { Text } = Typography;

export const mockEntityDataWithoutNesting: Column[] = [
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
        tagFQN: 'PersonalData.Category1',
        description:
          'GDPR special category data is personal information of data subjects that is especially sensitive.',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'PersonalData.SpecialCategory',
        description:
          'GDPR special category data is personal information of data subjects that is especially sensitive.',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
    ],
    ordinalPosition: 1,
  },
];

export const mockEntityDataWithoutNestingResponse = [
  {
    children: [],
    description:
      'ID of the API client that called the Shopify API. For example, the ID for the online store is 580111.',
    name: 'api_client_id',
    tags: [
      {
        tagFQN: 'PersonalData.SpecialCategory',
        description:
          'GDPR special category data is personal information of data subjects that is especially sensitive.',
        source: 'Classification',
        labelType: 'Manual',
        state: 'Confirmed',
        isHighlighted: true,
      },
      {
        tagFQN: 'PersonalData.Category1',
        description:
          'GDPR special category data is personal information of data subjects that is especially sensitive.',
        source: 'Classification',
        labelType: 'Manual',
        state: 'Confirmed',
      },
    ],
    title: (
      <Text className="entity-title" data-testid="entity-title">
        api_client_id
      </Text>
    ),
    type: 'NUMERIC',
    tableConstraints: undefined,
    columnConstraint: undefined,
  },
  {
    children: [],
    description:
      'Full name of the app or channel. For example, Point of Sale, Online Store.',
    name: 'title',
    tags: [],
    title: (
      <Text className="entity-title" data-testid="entity-title">
        title
      </Text>
    ),
    type: 'VARCHAR',
    tableConstraints: undefined,
    columnConstraint: undefined,
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
        title: (
          <Text className="entity-title" data-testid="entity-title">
            id
          </Text>
        ),
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'first_name',
        tags: [],
        title: (
          <Text className="entity-title" data-testid="entity-title">
            first_name
          </Text>
        ),
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'last_name',
        tags: [],
        title: (
          <Text className="entity-title" data-testid="entity-title">
            last_name
          </Text>
        ),
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'email',
        tags: [],
        title: (
          <Text className="entity-title" data-testid="entity-title">
            email
          </Text>
        ),
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'address_line_1',
        tags: [],
        title: (
          <Text className="entity-title" data-testid="entity-title">
            address_line_1
          </Text>
        ),
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'address_line_2',
        tags: [],
        title: (
          <Text className="entity-title" data-testid="entity-title">
            address_line_2
          </Text>
        ),
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'post_code',
        tags: [],
        title: (
          <Text className="entity-title" data-testid="entity-title">
            post_code
          </Text>
        ),
        type: 'STRING',
      },
      {
        children: [],
        description: undefined,
        name: 'country',
        tags: [],
        title: (
          <Text className="entity-title" data-testid="entity-title">
            country
          </Text>
        ),
        type: 'STRING',
      },
    ],
    description: undefined,
    name: 'Customer',
    tags: [],
    title: (
      <Text className="entity-title" data-testid="entity-title">
        Customer
      </Text>
    ),
    type: 'RECORD',
  },
];

export const mockInvalidDataResponse = [
  {
    children: [],
    columnConstraint: undefined,
    tableConstraints: undefined,
    description: undefined,
    name: '',
    tags: undefined,
    title: (
      <Text className="entity-title" data-testid="entity-title">
        --
      </Text>
    ),
    type: undefined,
  },
];

export const mockTagsDataBeforeSortAndHighlight = [
  {
    tagFQN: 'gs1.term1',
    name: 'term1',
    displayName: '',
    description: 'term1 desc',
    style: {},
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'gs1.term2',
    name: 'term2',
    displayName: '',
    description: 'term2 desc',
    style: {},
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'gs1.term3',
    name: 'term3',
    displayName: '',
    description: 'term3 desc',
    style: {},
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
];

export const mockTagsDataAfterSortAndHighlight = [
  {
    tagFQN: 'gs1.term2',
    name: 'term2',
    displayName: '',
    description: 'term2 desc',
    style: {},
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
    isHighlighted: true,
  },
  {
    tagFQN: 'gs1.term1',
    name: 'term1',
    displayName: '',
    description: 'term1 desc',
    style: {},
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'gs1.term3',
    name: 'term3',
    displayName: '',
    description: 'term3 desc',
    style: {},
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
];

export const mockTagFQNsForHighlight = ['gs1.term2'];

export const mockGetSummaryListItemTypeResponse = DataType.Varchar;

export const mockListItemForTextBasedTitle = {
  name: 'Title1',
  dataType: DataType.Varchar,
  dataLength: 100,
  dataTypeDisplay: 'varchar',
  description:
    'Full name of the app or channel. For example, Point of Sale, Online Store.',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.api/client".title',
  tags: [],
  ordinalPosition: 2,
};

export const mockListItemForLinkBasedTitle = {
  ...mockListItemForTextBasedTitle,
  name: 'Title2',
  sourceUrl: 'https://task1.com',
};

export const mockTextBasedSummaryTitleResponse = (
  <Text className="entity-title" data-testid="entity-title">
    <span className="text-highlight">Title1</span>
  </Text>
);

export const mockLinkBasedSummaryTitleResponse = (
  <Link target="_blank" to={{ pathname: 'https://task1.com' }}>
    <div className="d-flex">
      <Text
        className="entity-title text-link-color font-medium m-r-xss"
        data-testid="entity-title"
        ellipsis={{ tooltip: true }}>
        Title2
      </Text>
      <IconExternalLink width={12} />
    </div>
  </Link>
);

export const mockHighlights = {
  'columns.name': ['<span>customer_id</span>', '<span>customer_name</span>'],
  'columns.description': [
    '<span>customer details</span>',
    '<span>customer address</span>',
  ],
};

export const mockGetMapOfListHighlightsResponse = {
  listHighlights: [
    '<span>customer_id</span>',
    '<span>customer_name</span>',
    '<span>customer details</span>',
    '<span>customer address</span>',
  ],
  listHighlightsMap: {
    customer_id: 0,
    customer_name: 1,
    'customer details': 2,
    'customer address': 3,
  },
};
