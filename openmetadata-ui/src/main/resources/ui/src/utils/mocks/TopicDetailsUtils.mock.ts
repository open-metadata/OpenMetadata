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

import {
  DataTypeTopic,
  LabelType,
  MessagingServiceType,
  SchemaType,
  State,
  TagSource,
  Topic,
} from 'generated/entity/data/topic';

export const mockTopicDetails: Topic = {
  id: 'be3e1a5d-40fa-48ba-a420-86b8427c9d6d',
  name: 'customer_events',
  fullyQualifiedName: 'sample_kafka.customer_events',
  partitions: 56,
  description:
    'Kafka topic to capture the customer events such as location updates or profile updates',
  service: {
    id: '00f4486e-2b54-4317-af71-716ec0150ab2',
    type: 'messagingService',
    name: 'sample_kafka',
    fullyQualifiedName: 'sample_kafka',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/messagingServices/00f4486e-2b54-4317-af71-716ec0150ab2',
  },
  serviceType: MessagingServiceType.Kafka,
  messageSchema: {
    schemaText: '',
    schemaType: SchemaType.Avro,
    schemaFields: [
      {
        name: 'Customer',
        dataType: DataTypeTopic.Record,
        fullyQualifiedName: 'sample_kafka.customer_events.Customer',
        tags: [
          {
            tagFQN: 'TagClass.tag1',
            description: '',
            source: TagSource.Tag,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
          {
            tagFQN: 'PersonalData.Personal',
            description:
              'Data that can be used to directly or indirectly identify a person.',
            source: TagSource.Tag,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
          {
            tagFQN: 'PII.NonSensitive',
            description:
              'PII which is easily accessible from public sources and can include zip code, race, gender, and date of birth.',
            source: TagSource.Tag,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ],
      },
    ],
  },
};

export const mockSortedTopicDetails: Topic = {
  id: 'be3e1a5d-40fa-48ba-a420-86b8427c9d6d',
  name: 'customer_events',
  fullyQualifiedName: 'sample_kafka.customer_events',
  partitions: 56,
  description:
    'Kafka topic to capture the customer events such as location updates or profile updates',
  service: {
    id: '00f4486e-2b54-4317-af71-716ec0150ab2',
    type: 'messagingService',
    name: 'sample_kafka',
    fullyQualifiedName: 'sample_kafka',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/messagingServices/00f4486e-2b54-4317-af71-716ec0150ab2',
  },
  tags: [],
  serviceType: MessagingServiceType.Kafka,
  messageSchema: {
    schemaText: '',
    schemaType: SchemaType.Avro,
    schemaFields: [
      {
        name: 'Customer',
        dataType: DataTypeTopic.Record,
        fullyQualifiedName: 'sample_kafka.customer_events.Customer',
        tags: [
          {
            tagFQN: 'PersonalData.Personal',
            description:
              'Data that can be used to directly or indirectly identify a person.',
            source: TagSource.Tag,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
          {
            tagFQN: 'PII.NonSensitive',
            description:
              'PII which is easily accessible from public sources and can include zip code, race, gender, and date of birth.',
            source: TagSource.Tag,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
          {
            tagFQN: 'TagClass.tag1',
            description: '',
            source: TagSource.Tag,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ],
      },
    ],
  },
};
