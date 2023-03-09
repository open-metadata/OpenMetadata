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
import { DataTypeTopic, Field } from '../generated/entity/data/topic';
import { updateFieldDescription, updateFieldTags } from './TopicSchema.utils';

const mockTagOptions = [
  {
    fqn: 'PII.Sensitive',
    source: 'Classification',
  },
  {
    fqn: 'PersonalData.Personal',
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

const nestedField = {
  name: 'Order',
  displayName: 'Order',
  dataType: DataTypeTopic.Record,
  description: 'All the order events on our online store',
  children: [
    {
      name: 'order_id',
      dataType: DataTypeTopic.Int,
      description: 'order_id',
    },
    {
      name: 'api_client_id',
      dataType: DataTypeTopic.Int,
      description: 'api_client_id',
    },
  ],
};

const singleField = {
  name: 'id',
  dataType: DataTypeTopic.String,
  fullyQualifiedName: 'sample_kafka.customer_events.id',
};

const updatedNestedField: Field = {
  name: 'Order',
  displayName: 'Order',
  dataType: DataTypeTopic.Record,
  description: 'All the order events on our online store',
  children: [
    {
      name: 'order_id',
      dataType: DataTypeTopic.Int,
      description: 'order_id',
    },
    {
      name: 'api_client_id',
      dataType: DataTypeTopic.Int,
      description: 'updated description',
    },
  ],
};

const updatedSingleField = {
  name: 'id',
  dataType: DataTypeTopic.String,
  fullyQualifiedName: 'sample_kafka.customer_events.id',
  description: 'updated description',
};

const nestedFieldWithTags = {
  name: 'Order',
  displayName: 'Order',
  dataType: DataTypeTopic.Record,
  description: 'All the order events on our online store',
  children: [
    {
      name: 'order_id',
      dataType: DataTypeTopic.Int,
      description: 'order_id',
      tags: [],
    },
    {
      name: 'api_client_id',
      dataType: DataTypeTopic.Int,
      description: 'api_client_id',
      tags: [],
    },
  ],
};

const updatedNestedFieldWithTags: Field = {
  name: 'Order',
  displayName: 'Order',
  dataType: DataTypeTopic.Record,
  description: 'All the order events on our online store',
  children: [
    {
      name: 'order_id',
      dataType: DataTypeTopic.Int,
      description: 'order_id',
      tags: mockTags as Field['tags'],
    },
    {
      name: 'api_client_id',
      dataType: DataTypeTopic.Int,
      description: 'api_client_id',
      tags: [],
    },
  ],
};

describe('Topic schema field utils', () => {
  it('updateFieldDescription method should update the field', () => {
    const schemaFields = [singleField, nestedField];

    // updated the single field
    updateFieldDescription(schemaFields, 'id', 'updated description');

    // updated the nested field
    updateFieldDescription(
      schemaFields,
      'api_client_id',
      'updated description'
    );

    const updatedSchemaFields = [updatedSingleField, updatedNestedField];

    expect(schemaFields).toEqual(updatedSchemaFields);
  });

  it('updateFieldTags method should update the field', () => {
    const schemaFields = [
      { ...singleField, tags: [], description: 'updated description' },
    ];

    // updated the single field
    updateFieldTags(schemaFields, 'id', mockTagOptions);

    const updatedSchemaFields = [{ ...updatedSingleField, tags: mockTags }];

    expect(schemaFields).toEqual(updatedSchemaFields);
  });

  it('updateFieldTags method should update the nested field', () => {
    const schemaFields = [nestedFieldWithTags];

    // updated the single field
    updateFieldTags(schemaFields, 'order_id', mockTagOptions);

    const updatedSchemaFields = [updatedNestedFieldWithTags];

    expect(schemaFields).toEqual(updatedSchemaFields);
  });
});
