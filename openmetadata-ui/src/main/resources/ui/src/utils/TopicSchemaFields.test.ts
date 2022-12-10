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
import { DataTypeTopic, Field } from '../generated/entity/data/topic';
import { updateFieldDescription } from './TopicSchemaFields.utils';

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
});
