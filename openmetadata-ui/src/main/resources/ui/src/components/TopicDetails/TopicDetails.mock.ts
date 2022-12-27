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

import { Topic } from '../../generated/entity/data/topic';
import { nestedField } from './TopicSchema/TopicSchema.mock';

/* eslint-disable max-len */

export const MESSAGE_SCHEMA = {
  schemaText:
    '{"namespace":"openmetadata.kafka","name":"Customer","type":"record","fields":[{"name":"id","type":"string"},{"name":"first_name","type":"string"},{"name":"last_name","type":"string"},{"name":"email","type":"string"},{"name":"address_line_1","type":"string"},{"name":"address_line_2","type":"string"},{"name":"post_code","type":"string"},{"name":"country","type":"string"}]}',
  schemaType: 'Avro',
  schemaFields: [
    nestedField,
    {
      name: 'id',
      dataType: 'STRING',
      fullyQualifiedName: 'sample_kafka.customer_events.id',
      tags: [],
    },
    {
      name: 'first_name',
      dataType: 'STRING',
      fullyQualifiedName: 'sample_kafka.customer_events.first_name',
      tags: [],
    },
    {
      name: 'last_name',
      dataType: 'STRING',
      fullyQualifiedName: 'sample_kafka.customer_events.last_name',
      tags: [],
    },
    {
      name: 'email',
      dataType: 'STRING',
      fullyQualifiedName: 'sample_kafka.customer_events.email',
      tags: [],
    },
    {
      name: 'address_line_1',
      dataType: 'STRING',
      fullyQualifiedName: 'sample_kafka.customer_events.address_line_1',
      tags: [],
    },
    {
      name: 'address_line_2',
      dataType: 'STRING',
      fullyQualifiedName: 'sample_kafka.customer_events.address_line_2',
      tags: [],
    },
    {
      name: 'post_code',
      dataType: 'STRING',
      fullyQualifiedName: 'sample_kafka.customer_events.post_code',
      tags: [],
    },
    {
      name: 'country',
      dataType: 'STRING',
      fullyQualifiedName: 'sample_kafka.customer_events.country',
      tags: [],
    },
  ],
};

export const TOPIC_DETAILS = {
  id: '3005041d-bb99-4ad0-b8c1-caded8c7af3f',
  name: 'customer_events',
  fullyQualifiedName: 'sample_kafka.customer_events',
  description:
    'Kafka topic to capture the customer events such as location updates or profile updates',
  version: 0.1,
  updatedAt: 1670909133258,
  updatedBy: 'admin',
  service: {
    id: 'f797f374-c462-4ba1-88a2-aca84e099201',
    type: 'messagingService',
    name: 'sample_kafka',
    fullyQualifiedName: 'sample_kafka',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/messagingServices/f797f374-c462-4ba1-88a2-aca84e099201',
  },
  serviceType: 'Kafka',
  messageSchema: {
    schemaText:
      '{"namespace":"openmetadata.kafka","name":"Customer","type":"record","fields":[{"name":"id","type":"string"},{"name":"first_name","type":"string"},{"name":"last_name","type":"string"},{"name":"email","type":"string"},{"name":"address_line_1","type":"string"},{"name":"address_line_2","type":"string"},{"name":"post_code","type":"string"},{"name":"country","type":"string"}]}',
    schemaType: 'Avro',
    schemaFields: [
      {
        name: 'id',
        dataType: 'STRING',
        fullyQualifiedName: 'sample_kafka.customer_events.id',
        tags: [],
      },
      {
        name: 'first_name',
        dataType: 'STRING',
        fullyQualifiedName: 'sample_kafka.customer_events.first_name',
        tags: [],
      },
      {
        name: 'last_name',
        dataType: 'STRING',
        fullyQualifiedName: 'sample_kafka.customer_events.last_name',
        tags: [],
      },
      {
        name: 'email',
        dataType: 'STRING',
        fullyQualifiedName: 'sample_kafka.customer_events.email',
        tags: [],
      },
      {
        name: 'address_line_1',
        dataType: 'STRING',
        fullyQualifiedName: 'sample_kafka.customer_events.address_line_1',
        tags: [],
      },
      {
        name: 'address_line_2',
        dataType: 'STRING',
        fullyQualifiedName: 'sample_kafka.customer_events.address_line_2',
        tags: [],
      },
      {
        name: 'post_code',
        dataType: 'STRING',
        fullyQualifiedName: 'sample_kafka.customer_events.post_code',
        tags: [],
      },
      {
        name: 'country',
        dataType: 'STRING',
        fullyQualifiedName: 'sample_kafka.customer_events.country',
        tags: [],
      },
    ],
  },
  partitions: 56,
  cleanupPolicies: ['delete'],
  replicationFactor: 2,
  maximumMessageSize: 167,
  retentionSize: 455858109,
  followers: [],
  tags: [],
  href: 'http://localhost:8585/api/v1/topics/3005041d-bb99-4ad0-b8c1-caded8c7af3f',
  deleted: false,
} as Topic;
