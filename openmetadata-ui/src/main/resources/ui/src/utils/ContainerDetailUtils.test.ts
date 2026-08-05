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

import { EntityType } from '../enums/entity.enum';
import { Column, DataType } from '../generated/entity/data/container';
import {
  updateContainerColumnDescription,
  updateContainerColumnTags,
} from './ContainerDetailPureUtils';
import { getEntityDetailsPath } from './RouterUtils';

const SAMPLE_KAFKA_CUSTOMER_EVENTS_ORDER_API_CLIENT_ID =
  'sample_kafka.customer_events.Order.api_client_id';
const SAMPLE_KAFKA_CUSTOMER_EVENTS_ORDER_ORDER_ID =
  'sample_kafka.customer_events.Order.order_id';
const ALL_THE_ORDER_EVENTS_ON_OUR_ONLINE_STORE =
  'All the order events on our online store';
const SAMPLE_KAFKA_CUSTOMER_EVENTS_ID = 'sample_kafka.customer_events.id';
const UPDATED_DESCRIPTION = 'updated description';
const mockTagOptions = [
  {
    tagFQN: 'PII.Sensitive',
    source: 'Classification',
  },
  {
    tagFQN: 'PersonalData.Personal',
    source: 'Classification',
  },
];

const mockTags = [
  {
    tagFQN: 'PII.Sensitive',
    source: 'Classification',
    labelType: 'Manual',
    state: 'Confirmed',
  },
  {
    tagFQN: 'PersonalData.Personal',
    source: 'Classification',
    labelType: 'Manual',
    state: 'Confirmed',
  },
];

const nestedColumn = {
  name: 'Order',
  displayName: 'Order',
  dataType: DataType.Record,
  description: ALL_THE_ORDER_EVENTS_ON_OUR_ONLINE_STORE,
  children: [
    {
      name: 'order_id',
      dataType: DataType.Int,
      description: 'order_id',
      fullyQualifiedName: SAMPLE_KAFKA_CUSTOMER_EVENTS_ORDER_ORDER_ID,
    },
    {
      name: 'api_client_id',
      dataType: DataType.Int,
      description: 'api_client_id',
      fullyQualifiedName: SAMPLE_KAFKA_CUSTOMER_EVENTS_ORDER_API_CLIENT_ID,
    },
  ],
};

const singleColumn = {
  name: 'id',
  dataType: DataType.String,
  fullyQualifiedName: SAMPLE_KAFKA_CUSTOMER_EVENTS_ID,
};

const updatedNestedColumn: Column = {
  name: 'Order',
  displayName: 'Order',
  dataType: DataType.Record,
  description: ALL_THE_ORDER_EVENTS_ON_OUR_ONLINE_STORE,
  children: [
    {
      name: 'order_id',
      dataType: DataType.Int,
      description: 'order_id',
      fullyQualifiedName: SAMPLE_KAFKA_CUSTOMER_EVENTS_ORDER_ORDER_ID,
    },
    {
      name: 'api_client_id',
      dataType: DataType.Int,
      description: UPDATED_DESCRIPTION,
      fullyQualifiedName: SAMPLE_KAFKA_CUSTOMER_EVENTS_ORDER_API_CLIENT_ID,
    },
  ],
};

const updatedSingleColumn = {
  name: 'id',
  dataType: DataType.String,
  fullyQualifiedName: SAMPLE_KAFKA_CUSTOMER_EVENTS_ID,
  description: UPDATED_DESCRIPTION,
};

const nestedColumnWithTags = {
  name: 'Order',
  displayName: 'Order',
  dataType: DataType.Record,
  description: ALL_THE_ORDER_EVENTS_ON_OUR_ONLINE_STORE,
  children: [
    {
      name: 'order_id',
      dataType: DataType.Int,
      description: 'order_id',
      tags: [],
      fullyQualifiedName: SAMPLE_KAFKA_CUSTOMER_EVENTS_ORDER_ORDER_ID,
    },
    {
      name: 'api_client_id',
      dataType: DataType.Int,
      description: 'api_client_id',
      tags: [],
      fullyQualifiedName: SAMPLE_KAFKA_CUSTOMER_EVENTS_ORDER_API_CLIENT_ID,
    },
  ],
};

const updatedNestedColumnWithTags: Column = {
  name: 'Order',
  displayName: 'Order',
  dataType: DataType.Record,
  description: ALL_THE_ORDER_EVENTS_ON_OUR_ONLINE_STORE,
  children: [
    {
      name: 'order_id',
      dataType: DataType.Int,
      description: 'order_id',
      tags: mockTags as Column['tags'],
      fullyQualifiedName: SAMPLE_KAFKA_CUSTOMER_EVENTS_ORDER_ORDER_ID,
    },
    {
      name: 'api_client_id',
      dataType: DataType.Int,
      description: 'api_client_id',
      tags: [],
      fullyQualifiedName: SAMPLE_KAFKA_CUSTOMER_EVENTS_ORDER_API_CLIENT_ID,
    },
  ],
};

describe('getContainerDetailPath', () => {
  it('returns the correct path without tab', () => {
    const containerFQN = 'my-container';
    const path = getEntityDetailsPath(EntityType.CONTAINER, containerFQN);

    expect(path).toEqual(`/container/${containerFQN}`);
  });

  it('returns the correct path with tab', () => {
    const containerFQN = 'my-container';
    const tab = 'my-tab';
    const path = getEntityDetailsPath(EntityType.CONTAINER, containerFQN, tab);

    expect(path).toEqual(`/container/${containerFQN}/${tab}`);
  });

  it('updateContainerColumnDescription method should update the column', () => {
    const containerColumns = [singleColumn, nestedColumn];

    // updated the single column
    updateContainerColumnDescription(
      containerColumns,
      SAMPLE_KAFKA_CUSTOMER_EVENTS_ID,
      UPDATED_DESCRIPTION
    );

    // updated the nested column
    updateContainerColumnDescription(
      containerColumns,
      SAMPLE_KAFKA_CUSTOMER_EVENTS_ORDER_API_CLIENT_ID,
      UPDATED_DESCRIPTION
    );

    const updatedContainerColumns = [updatedSingleColumn, updatedNestedColumn];

    expect(containerColumns).toEqual(updatedContainerColumns);
  });

  it('updateContainerColumnTags method should update the column', () => {
    const containerColumns = [
      { ...singleColumn, tags: [], description: UPDATED_DESCRIPTION },
    ];

    // updated the single column
    updateContainerColumnTags(
      containerColumns,
      SAMPLE_KAFKA_CUSTOMER_EVENTS_ID,
      mockTagOptions
    );

    const updatedContainerColumns = [
      { ...updatedSingleColumn, tags: mockTags },
    ];

    expect(containerColumns).toEqual(updatedContainerColumns);
  });

  it('updateContainerColumnTags method should update the nested column', () => {
    const containerColumns = [nestedColumnWithTags];

    // updated the single column
    updateContainerColumnTags(
      containerColumns,
      SAMPLE_KAFKA_CUSTOMER_EVENTS_ORDER_ORDER_ID,
      mockTagOptions
    );

    const updatedContainerColumns = [updatedNestedColumnWithTags];

    expect(containerColumns).toEqual(updatedContainerColumns);
  });
});
