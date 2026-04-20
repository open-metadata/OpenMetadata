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

jest.mock(
  '../jsons/connectionSchemas/connections/messaging/kafkaConnection.json',
  () => ({}),
  { virtual: true }
);
jest.mock(
  '../jsons/connectionSchemas/connections/messaging/redpandaConnection.json',
  () => ({}),
  { virtual: true }
);
jest.mock(
  '../jsons/connectionSchemas/connections/messaging/customMessagingConnection.json',
  () => ({}),
  { virtual: true }
);
jest.mock(
  '../jsons/connectionSchemas/connections/messaging/kinesisConnection.json',
  () => ({}),
  { virtual: true }
);
jest.mock(
  '../jsons/connectionSchemas/connections/messaging/pubSubConnection.json',
  () => ({}),
  { virtual: true }
);

import { COMMON_UI_SCHEMA } from '../constants/ServiceUISchema.constant';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import { getMessagingConfig } from './MessagingServiceUtils';

describe('MessagingServiceUtils', () => {
  it('Kafka uiSchema should include ui:emptyValue for schemaRegistryTopicSuffixName', () => {
    const config = getMessagingConfig(MessagingServiceType.Kafka);

    expect(config.uiSchema).toMatchObject({
      ...COMMON_UI_SCHEMA,
      schemaRegistryTopicSuffixName: {
        'ui:emptyValue': '',
      },
    });
  });

  it('Redpanda uiSchema should include ui:emptyValue for schemaRegistryTopicSuffixName', () => {
    const config = getMessagingConfig(MessagingServiceType.Redpanda);

    expect(config.uiSchema).toMatchObject({
      ...COMMON_UI_SCHEMA,
      schemaRegistryTopicSuffixName: {
        'ui:emptyValue': '',
      },
    });
  });

  it('non-broker services should not include schemaRegistryTopicSuffixName uiSchema', () => {
    const config = getMessagingConfig(MessagingServiceType.Kinesis);

    expect(config.uiSchema).not.toHaveProperty('schemaRegistryTopicSuffixName');
  });

  it('getMessagingConfig should return only common UI schema for invalid types', () => {
    const config = getMessagingConfig('' as MessagingServiceType);

    expect(config.uiSchema).toEqual({ ...COMMON_UI_SCHEMA });
  });
});
