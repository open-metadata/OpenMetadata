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
} from './ContainerDetailUtils';
import { getEntityDetailsPath } from './RouterUtils';

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
  description: 'All the order events on our online store',
  children: [
    {
      name: 'order_id',
      dataType: DataType.Int,
      description: 'order_id',
      fullyQualifiedName: 'sample_kafka.customer_events.Order.order_id',
    },
    {
      name: 'api_client_id',
      dataType: DataType.Int,
      description: 'api_client_id',
      fullyQualifiedName: 'sample_kafka.customer_events.Order.api_client_id',
    },
  ],
};

const singleColumn = {
  name: 'id',
  dataType: DataType.String,
  fullyQualifiedName: 'sample_kafka.customer_events.id',
};

const updatedNestedColumn: Column = {
  name: 'Order',
  displayName: 'Order',
  dataType: DataType.Record,
  description: 'All the order events on our online store',
  children: [
    {
      name: 'order_id',
      dataType: DataType.Int,
      description: 'order_id',
      fullyQualifiedName: 'sample_kafka.customer_events.Order.order_id',
    },
    {
      name: 'api_client_id',
      dataType: DataType.Int,
      description: 'updated description',
      fullyQualifiedName: 'sample_kafka.customer_events.Order.api_client_id',
    },
  ],
};

const updatedSingleColumn = {
  name: 'id',
  dataType: DataType.String,
  fullyQualifiedName: 'sample_kafka.customer_events.id',
  description: 'updated description',
};

const nestedColumnWithTags = {
  name: 'Order',
  displayName: 'Order',
  dataType: DataType.Record,
  description: 'All the order events on our online store',
  children: [
    {
      name: 'order_id',
      dataType: DataType.Int,
      description: 'order_id',
      tags: [],
      fullyQualifiedName: 'sample_kafka.customer_events.Order.order_id',
    },
    {
      name: 'api_client_id',
      dataType: DataType.Int,
      description: 'api_client_id',
      tags: [],
      fullyQualifiedName: 'sample_kafka.customer_events.Order.api_client_id',
    },
  ],
};

const updatedNestedColumnWithTags: Column = {
  name: 'Order',
  displayName: 'Order',
  dataType: DataType.Record,
  description: 'All the order events on our online store',
  children: [
    {
      name: 'order_id',
      dataType: DataType.Int,
      description: 'order_id',
      tags: mockTags as Column['tags'],
      fullyQualifiedName: 'sample_kafka.customer_events.Order.order_id',
    },
    {
      name: 'api_client_id',
      dataType: DataType.Int,
      description: 'api_client_id',
      tags: [],
      fullyQualifiedName: 'sample_kafka.customer_events.Order.api_client_id',
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
      'sample_kafka.customer_events.id',
      'updated description'
    );

    // updated the nested column
    updateContainerColumnDescription(
      containerColumns,
      'sample_kafka.customer_events.Order.api_client_id',
      'updated description'
    );

    const updatedContainerColumns = [updatedSingleColumn, updatedNestedColumn];

    expect(containerColumns).toEqual(updatedContainerColumns);
  });

  it('updateContainerColumnTags method should update the column', () => {
    const containerColumns = [
      { ...singleColumn, tags: [], description: 'updated description' },
    ];

    // updated the single column
    updateContainerColumnTags(
      containerColumns,
      'sample_kafka.customer_events.id',
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
      'sample_kafka.customer_events.Order.order_id',
      mockTagOptions
    );

    const updatedContainerColumns = [updatedNestedColumnWithTags];

    expect(containerColumns).toEqual(updatedContainerColumns);
  });
});
