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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Typography } from 'antd';
import React from 'react';
import { Link } from 'react-router-dom';
import { BasicEntityInfo } from '../../components/Explore/EntitySummaryPanel/SummaryList/SummaryList.interface';
import { ICON_DIMENSION } from '../../constants/constants';
import { Task } from '../../generated/entity/data/pipeline';
import {
  StoredProcedure,
  StoredProcedureCodeObject,
} from '../../generated/entity/data/storedProcedure';
import {
  Column,
  DataType,
  LabelType,
  State,
  TagSource,
} from '../../generated/entity/data/table';
import { EntityReference } from '../../generated/type/entityReference';
import { ReactComponent as IconExternalLink } from '../assets/svg/external-links.svg';

const { Text } = Typography;

export const mockTextBasedSummaryTitleResponse = (
  <Text
    className="entity-title"
    data-testid="entity-title"
    ellipsis={{ tooltip: true }}>
    <span className="text-highlighter">title2</span>
  </Text>
);

export const mockLinkBasedSummaryTitleResponse = (
  <Link
    target="_blank"
    to={{
      pathname:
        'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=dim_address_task',
    }}>
    <div className="d-flex items-center">
      <Text
        className="entity-title text-link-color font-medium m-r-xss"
        data-testid="entity-title"
        ellipsis={{ tooltip: true }}>
        dim_address Task
      </Text>
      <Icon component={IconExternalLink} style={ICON_DIMENSION} />
    </div>
  </Link>
);

export const mockLinkBasedSummaryTitleDashboardResponse = (
  <Link to="/dashboard/sample_superset.10">
    <Text
      className="entity-title text-link-color font-medium m-r-xss"
      data-testid="entity-title"
      ellipsis={{ tooltip: true }}>
      deck.gl Demo
    </Text>
  </Link>
);

export const mockGetSummaryListItemTypeResponse = 'PrestoOperator';

export const mockTagsSortAndHighlightResponse = [
  {
    tagFQN: 'PersonalData.SpecialCategory',
    description:
      'GDPR special category data is personal information of data subjects that is especially sensitive.',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
    isHighlighted: true,
  },
  {
    tagFQN: 'PersonalData.Category1',
    description:
      'GDPR special category data is personal information of data subjects that is especially sensitive.',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
];

export const mockTagFQNsForHighlight = ['PersonalData.SpecialCategory'];

export const mockListItemNameHighlight =
  '<span className="text-highlighter">title2</span>';

const mockListItemDescriptionHighlight =
  'some description of <span className="text-highlighter">title2</span>';

export const mockHighlights = {
  'columns.name': [mockListItemNameHighlight],
  'columns.description': [mockListItemDescriptionHighlight],
  'tag.name': mockTagFQNsForHighlight,
};

export const mockGetMapOfListHighlightsResponse = {
  listHighlights: [mockListItemNameHighlight, mockListItemDescriptionHighlight],
  listHighlightsMap: {
    title2: 0,
    'some description of title2': 1,
  },
};

export const mockGetHighlightOfListItemResponse = {
  highlightedTags: undefined,
  highlightedTitle: mockListItemNameHighlight,
  highlightedDescription: mockListItemDescriptionHighlight,
};

export const mockEntityDataWithoutNesting: Task[] = [
  {
    name: 'dim_address_task',
    displayName: 'dim_address Task',
    fullyQualifiedName: 'sample_airflow.dim_address_etl.dim_address_task',
    description:
      'Airflow operator to perform ETL and generate dim_address table',
    sourceUrl:
      'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=dim_address_task',
    downstreamTasks: ['assert_table_exists'],
    taskType: 'PrestoOperator',
    tags: [],
  },
  {
    name: 'assert_table_exists',
    displayName: 'Assert Table Exists',
    fullyQualifiedName: 'sample_airflow.dim_address_etl.assert_table_exists',
    description: 'Assert if a table exists',
    sourceUrl:
      'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
    downstreamTasks: [],
    taskType: 'HiveOperator',
    tags: [],
  },
];

export const mockEntityReferenceDashboardData: EntityReference = {
  deleted: false,
  description: '',
  displayName: 'deck.gl Demo',
  fullyQualifiedName: 'sample_superset.10',
  id: '77a0ac8a-ca1a-4f21-9a37-406faa482008',
  name: '10',
  type: 'dashboard',
};

export const mockEntityDataWithoutNestingResponse: BasicEntityInfo[] = [
  {
    name: 'dim_address_task',
    title: mockLinkBasedSummaryTitleResponse,
    description:
      'Airflow operator to perform ETL and generate dim_address table',
    type: mockGetSummaryListItemTypeResponse,
    tags: [],
  },
  {
    name: 'assert_table_exists',
    title: (
      <Link
        target="_blank"
        to={{
          pathname:
            'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
        }}>
        <div className="d-flex items-center">
          <Text
            className="entity-title text-link-color font-medium m-r-xss"
            data-testid="entity-title"
            ellipsis={{ tooltip: true }}>
            Assert Table Exists
          </Text>
          <Icon component={IconExternalLink} style={ICON_DIMENSION} />
        </div>
      </Link>
    ),
    description: 'Assert if a table exists',
    type: 'HiveOperator',
    tags: [],
  },
];

export const mockEntityDataWithNesting: Column[] = [
  {
    name: 'Customer',
    dataType: DataType.Varchar,
    fullyQualifiedName: 'sample_kafka.customer_events.Customer',
    tags: [],
    description:
      'Full name of the app or channel. For example, Point of Sale, Online Store.',
    children: [
      {
        name: 'id',
        dataType: DataType.Varchar,
        fullyQualifiedName: 'sample_kafka.customer_events.Customer.id',
        tags: [],
      },
      {
        name: 'first_name',
        dataType: DataType.Varchar,
        fullyQualifiedName: 'sample_kafka.customer_events.Customer.first_name',
        tags: [],
      },
      {
        name: 'last_name',
        dataType: DataType.Varchar,
        fullyQualifiedName: 'sample_kafka.customer_events.Customer.last_name',
        tags: [],
      },
      {
        name: 'email',
        dataType: DataType.Varchar,
        fullyQualifiedName: 'sample_kafka.customer_events.Customer.email',
        tags: [],
      },
    ],
  },
  {
    name: 'title2',
    dataType: DataType.Varchar,
    dataLength: 100,
    dataTypeDisplay: 'varchar',
    description: 'some description of title2',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify."dim.api/client".title2',
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

export const mockEntityDataWithNestingResponse: BasicEntityInfo[] = [
  {
    name: 'title2',
    title: mockTextBasedSummaryTitleResponse,
    type: DataType.Varchar,
    description: mockListItemDescriptionHighlight,
    tags: [],
    tableConstraints: undefined,
    columnConstraint: undefined,
    children: [],
  },
  {
    name: 'api_client_id',
    title: (
      <Text
        className="entity-title"
        data-testid="entity-title"
        ellipsis={{ tooltip: true }}>
        api_client_id
      </Text>
    ),
    type: DataType.Numeric,
    description:
      'ID of the API client that called the Shopify API. For example, the ID for the online store is 580111.',
    tags: mockTagsSortAndHighlightResponse,
    tableConstraints: undefined,
    columnConstraint: undefined,
    children: [],
  },
  {
    name: 'Customer',
    title: (
      <Text
        className="entity-title"
        data-testid="entity-title"
        ellipsis={{ tooltip: true }}>
        Customer
      </Text>
    ),
    type: DataType.Varchar,
    tags: [],
    description:
      'Full name of the app or channel. For example, Point of Sale, Online Store.',
    tableConstraints: undefined,
    columnConstraint: undefined,
    children: [
      {
        name: 'id',
        title: (
          <Text
            className="entity-title"
            data-testid="entity-title"
            ellipsis={{ tooltip: true }}>
            id
          </Text>
        ),
        type: DataType.Varchar,
        tags: [],
        children: [],
        description: undefined,
        tableConstraints: undefined,
        columnConstraint: undefined,
      },
      {
        name: 'first_name',
        title: (
          <Text
            className="entity-title"
            data-testid="entity-title"
            ellipsis={{ tooltip: true }}>
            first_name
          </Text>
        ),
        type: DataType.Varchar,
        tags: [],
        children: [],
        description: undefined,
        tableConstraints: undefined,
        columnConstraint: undefined,
      },
      {
        name: 'last_name',
        title: (
          <Text
            className="entity-title"
            data-testid="entity-title"
            ellipsis={{ tooltip: true }}>
            last_name
          </Text>
        ),
        type: DataType.Varchar,
        tags: [],
        children: [],
        description: undefined,
        tableConstraints: undefined,
        columnConstraint: undefined,
      },
      {
        name: 'email',
        title: (
          <Text
            className="entity-title"
            data-testid="entity-title"
            ellipsis={{ tooltip: true }}>
            email
          </Text>
        ),
        type: DataType.Varchar,
        tags: [],
        children: [],
        description: undefined,
        tableConstraints: undefined,
        columnConstraint: undefined,
      },
    ],
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
      <Text
        className="entity-title"
        data-testid="entity-title"
        ellipsis={{ tooltip: true }}>
        --
      </Text>
    ),
    type: undefined,
  },
];

export const mockStoredProcedureWithCode: StoredProcedure = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'test_stored_procedure',
  fullyQualifiedName: 'sample_database.test_stored_procedure',
  description: 'A test stored procedure',
  storedProcedureCode: {
    language: 'SQL',
    code: 'CREATE PROCEDURE test_stored_procedure()\nBEGIN\n  SELECT * FROM users;\nEND',
  } as StoredProcedureCodeObject,
  databaseSchema: {
    id: '456e7890-e12b-34c5-d678-901234567890',
    name: 'test_schema',
    fullyQualifiedName: 'sample_database.test_schema',
    type: 'databaseSchema',
  },
  database: {
    id: '789e0123-e45f-67g8-h901-234567890123',
    name: 'sample_database',
    fullyQualifiedName: 'sample_database',
    type: 'database',
  },
  service: {
    id: '012e3456-e78h-90i1-j234-567890123456',
    name: 'mysql_service',
    fullyQualifiedName: 'mysql_service',
    type: 'databaseService',
  },
};

export const mockStoredProcedureWithoutCode: StoredProcedure = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'test_stored_procedure_no_code',
  fullyQualifiedName: 'sample_database.test_stored_procedure_no_code',
  description: 'A test stored procedure without code',
  storedProcedureCode: null,
  databaseSchema: {
    id: '456e7890-e12b-34c5-d678-901234567890',
    name: 'test_schema',
    fullyQualifiedName: 'sample_database.test_schema',
    type: 'databaseSchema',
  },
  database: {
    id: '789e0123-e45f-67g8-h901-234567890123',
    name: 'sample_database',
    fullyQualifiedName: 'sample_database',
    type: 'database',
  },
  service: {
    id: '012e3456-e78h-90i1-j234-567890123456',
    name: 'mysql_service',
    fullyQualifiedName: 'mysql_service',
    type: 'databaseService',
  },
};

export const mockStoredProcedureWithEmptyCode: StoredProcedure = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  name: 'test_stored_procedure_empty_code',
  fullyQualifiedName: 'sample_database.test_stored_procedure_empty_code',
  description: 'A test stored procedure with empty code',
  storedProcedureCode: {
    language: 'SQL',
    code: '',
  } as StoredProcedureCodeObject,
  databaseSchema: {
    id: '456e7890-e12b-34c5-d678-901234567890',
    name: 'test_schema',
    fullyQualifiedName: 'sample_database.test_schema',
    type: 'databaseSchema',
  },
  database: {
    id: '789e0123-e45f-67g8-h901-234567890123',
    name: 'sample_database',
    fullyQualifiedName: 'sample_database',
    type: 'database',
  },
  service: {
    id: '012e3456-e78h-90i1-j234-567890123456',
    name: 'mysql_service',
    fullyQualifiedName: 'mysql_service',
    type: 'databaseService',
  },
};
