/*
 *  Copyright 2025 Collate.
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
  MessagingServiceType,
  SchemaType,
  Topic,
} from '../generated/entity/data/topic';

export const TOPIC_DUMMY_DATA: Topic = {
  id: 'd68d2e86-41cd-4c6c-bd78-41db489d46d1',
  name: 'address_book',
  fullyQualifiedName: 'sample_kafka.address_book',
  description: 'All Protobuf record related events gets captured in this topic',
  version: 0.7,
  updatedAt: 1701432879105,
  updatedBy: 'aniket',
  service: {
    id: '46f09e52-34de-4580-8133-a7e54e23c22b',
    type: 'messagingService',
    name: 'sample_kafka',
    fullyQualifiedName: 'sample_kafka',
    displayName: 'sample_kafka',
    deleted: false,
  },
  serviceType: MessagingServiceType.Kafka,
  messageSchema: {
    schemaText:
      // eslint-disable-next-line max-len
      'syntax = "proto2";\n\npackage tutorial;\n\nmessage Person {\n  optional string name = 1;\n  optional int32 id = 2;\n  optional string email = 3;\n\n  enum PhoneType {\n    MOBILE = 0;\n    HOME = 1;\n    WORK = 2;\n  }\n\n  message PhoneNumber {\n    optional string number = 1;\n    optional PhoneType type = 2 [default = HOME];\n  }\n\n  repeated PhoneNumber phones = 4;\n}\n\nmessage AddressBook {\n  repeated Person people = 1;\n}',
    schemaType: SchemaType.Protobuf,
    schemaFields: [
      {
        name: 'AddressBook',
        dataType: DataTypeTopic.Record,
        fullyQualifiedName: 'sample_kafka.address_book.AddressBook',
        tags: [],
        children: [
          {
            name: 'people',
            dataType: DataTypeTopic.Record,
            fullyQualifiedName: 'sample_kafka.address_book.AddressBook.people',
            tags: [],
            children: [
              {
                name: 'name',
                dataType: DataTypeTopic.String,
                fullyQualifiedName:
                  'sample_kafka.address_book.AddressBook.people.name',
                tags: [],
              },
              {
                name: 'id',
                dataType: DataTypeTopic.Int,
                fullyQualifiedName:
                  'sample_kafka.address_book.AddressBook.people.id',
                tags: [],
              },
              {
                name: 'email',
                dataType: DataTypeTopic.String,
                fullyQualifiedName:
                  'sample_kafka.address_book.AddressBook.people.email',
                tags: [],
              },
              {
                name: 'phones',
                dataType: DataTypeTopic.Record,
                fullyQualifiedName:
                  'sample_kafka.address_book.AddressBook.people.phones',
                tags: [],
                children: [
                  {
                    name: 'number',
                    dataType: DataTypeTopic.String,
                    fullyQualifiedName:
                      'sample_kafka.address_book.AddressBook.people.phones.number',
                    tags: [],
                  },
                  {
                    name: 'type',
                    dataType: DataTypeTopic.Enum,
                    fullyQualifiedName:
                      'sample_kafka.address_book.AddressBook.people.phones.type',
                    tags: [],
                  },
                ],
              },
            ],
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
  owners: [
    {
      id: 'ebac156e-6779-499c-8bbf-ab98a6562bc5',
      type: 'team',
      name: 'Data',
      fullyQualifiedName: 'Data',
      description: '',
      displayName: 'Data',
      deleted: false,
    },
  ],
  followers: [
    {
      id: '96546482-1b99-4293-9e0f-7194fe25bcbf',
      type: 'user',
      name: 'sonal.w',
      fullyQualifiedName: '"sonal.w"',
      displayName: 'admin',
      deleted: false,
    },
  ],
  tags: [],
  deleted: false,
  domain: {
    id: '761f0a12-7b08-4889-acc3-b8d4d11a7865',
    type: 'domain',
    name: 'domain.with.dot',
    fullyQualifiedName: '"domain.with.dot"',
    description: 'domain.with.dot',
    displayName: 'domain.with.dot',
  },
  dataProducts: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};
