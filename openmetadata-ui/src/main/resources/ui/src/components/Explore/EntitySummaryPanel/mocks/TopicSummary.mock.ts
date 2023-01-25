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
  CleanupPolicy,
  DataTypeTopic,
  SchemaType,
  Topic,
} from '../../../../generated/entity/data/topic';

export const mockTopicEntityDetails: Topic = {
  id: '67e1dbbb-054c-4833-ba28-f95d71f0826f',
  name: 'product_events',
  displayName: 'product_events',
  fullyQualifiedName: 'sample_kafka.product_events',
  description:
    'Kafka topic to capture the product events. This topic will get updates on products decription, price etc.',
  version: 0.1,
  updatedAt: 1672627828429,
  updatedBy: 'admin',
  href: 'http://openmetadata-server:8585/api/v1/topics/67e1dbbb-054c-4833-ba28-f95d71f0826f',
  deleted: false,
  service: {
    id: '5d6f73f0-1811-49c8-8d1d-7a478ffd8177',
    type: 'messagingService',
    name: 'sample_kafka',
    fullyQualifiedName: 'sample_kafka',
    deleted: false,
    href: 'http://openmetadata-server:8585/api/v1/services/messagingServices/5d6f73f0-1811-49c8-8d1d-7a478ffd8177',
  },
  partitions: 0,
  cleanupPolicies: [CleanupPolicy.Delete],
  replicationFactor: 4,
  maximumMessageSize: 208,
  retentionSize: 1068320655,
  tags: [],
  followers: [],
};

export const mockTopicByFqnResponse = {
  partitions: 128,
  messageSchema: {
    schemaText:
      '{"namespace":"openmetadata.kafka","type":"record","name":"Product","fields":[{"name":"product_id","type":"int"}]}',
    schemaType: SchemaType.Avro,
    schemaFields: [
      {
        name: 'Product',
        dataType: DataTypeTopic.Record,
        fullyQualifiedName: 'sample_kafka.product_events.Product',
        tags: [],
        children: [
          {
            name: 'product_id',
            dataType: DataTypeTopic.Int,
            fullyQualifiedName:
              'sample_kafka.product_events.Product.product_id',
            tags: [],
          },
          {
            name: 'title',
            dataType: DataTypeTopic.String,
            fullyQualifiedName: 'sample_kafka.product_events.Product.title',
            tags: [],
          },
          {
            name: 'price',
            dataType: DataTypeTopic.Double,
            fullyQualifiedName: 'sample_kafka.product_events.Product.price',
            tags: [],
          },
          {
            name: 'sku',
            dataType: DataTypeTopic.String,
            fullyQualifiedName: 'sample_kafka.product_events.Product.sku',
            tags: [],
          },
          {
            name: 'barcode',
            dataType: DataTypeTopic.String,
            fullyQualifiedName: 'sample_kafka.product_events.Product.barcode',
            tags: [],
          },
          {
            name: 'shop_id',
            dataType: DataTypeTopic.Int,
            fullyQualifiedName: 'sample_kafka.product_events.Product.shop_id',
            tags: [],
          },
        ],
      },
    ],
  },
};
