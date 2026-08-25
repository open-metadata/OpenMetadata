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

import { TopicVersionProp } from '../components/Topic/TopicVersion/TopicVersion.interface';
import {
  CleanupPolicy,
  MessagingServiceType,
} from '../generated/entity/data/topic';
import { DataTypeTopic, SchemaType } from '../generated/type/schema';
import { ENTITY_PERMISSIONS } from '../mocks/Permissions.mock';
import {
  mockBackHandler,
  mockDomain,
  mockOwner,
  mockTier,
  mockVersionHandler,
  mockVersionList,
} from '../mocks/VersionCommon.mock';

export const mockTopicData = {
  id: 'eccc8f43-abd8-494b-9173-6b18644d5336',
  name: 'sales',
  fullyQualifiedName: 'sample_kafka.sales',
  description: 'All sales related events gets captured in this topic',
  version: 0.1,
  updatedAt: 1688382358829,
  updatedBy: 'admin',
  service: {
    id: 'c43ab59d-d96d-40af-9a63-6afcfa23baff',
    type: 'messagingService',
    name: 'sample_kafka',
    fullyQualifiedName: 'sample_kafka',
    deleted: false,
  },
  serviceType: MessagingServiceType.Kafka,
  messageSchema: {
    schemaText:
      '{namespace: "openmetadata.kafka",type: "record",name: "Order",fields: [  { name: "sale_id", type: "int" },],}',
    schemaType: SchemaType.Avro,
    schemaFields: [
      {
        name: 'Order',
        dataType: DataTypeTopic.Record,
        fullyQualifiedName: 'sample_kafka.sales.Order',
        tags: [],
        children: [
          {
            name: 'sale_id',
            dataType: DataTypeTopic.Int,
            dataTypeDisplay: 'int',
            fullyQualifiedName: 'sample_kafka.sales.Order.sale_id',
            tags: [],
          },
        ],
      },
    ],
  },
  partitions: 128,
  cleanupPolicies: [CleanupPolicy.Compact, CleanupPolicy.Delete],
  replicationFactor: 4,
  maximumMessageSize: 249,
  retentionSize: 1931232624,
  followers: [],
  tags: [],
  deleted: false,
};

export const topicVersionMockProps: TopicVersionProp = {
  version: '0.3',
  currentVersionData: mockTopicData,
  isVersionLoading: false,
  owners: mockOwner,
  domains: [mockDomain],
  dataProducts: [],
  tier: mockTier,
  slashedTopicName: [],
  versionList: mockVersionList,
  deleted: false,
  backHandler: mockBackHandler,
  versionHandler: mockVersionHandler,
  entityPermissions: ENTITY_PERMISSIONS,
};
