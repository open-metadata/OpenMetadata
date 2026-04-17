/*
 *  Copyright 2026 Collate.
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

import { COMMON_UI_SCHEMA } from '../constants/Services.constant';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import customMessagingConnection from '../jsons/connectionSchemas/connections/messaging/customMessagingConnection.json';
import kafkaConnection from '../jsons/connectionSchemas/connections/messaging/kafkaConnection.json';
import kinesisConnection from '../jsons/connectionSchemas/connections/messaging/kinesisConnection.json';
import pubSubConnection from '../jsons/connectionSchemas/connections/messaging/pubSubConnection.json';
import redpandaConnection from '../jsons/connectionSchemas/connections/messaging/redpandaConnection.json';
import { getMessagingConfig } from './MessagingServiceUtils';

describe('MessagingServiceUtils tests', () => {
  it('getMessagingConfig should return correct config for Kafka connector and preserve empty schema suffix', () => {
    const config = getMessagingConfig(MessagingServiceType.Kafka);

    expect(config).toEqual({
      schema: { ...kafkaConnection },
      uiSchema: {
        ...COMMON_UI_SCHEMA,
        schemaRegistryTopicSuffixName: { 'ui:emptyValue': '' },
      },
    });
  });

  it('getMessagingConfig should return correct config for Redpanda connector', () => {
    const config = getMessagingConfig(MessagingServiceType.Redpanda);

    expect(config).toEqual({
      schema: { ...redpandaConnection },
      uiSchema: { ...COMMON_UI_SCHEMA },
    });
  });

  it('getMessagingConfig should return correct config for CustomMessaging connector', () => {
    const config = getMessagingConfig(MessagingServiceType.CustomMessaging);

    expect(config).toEqual({
      schema: { ...customMessagingConnection },
      uiSchema: { ...COMMON_UI_SCHEMA },
    });
  });

  it('getMessagingConfig should return correct config for Kinesis connector', () => {
    const config = getMessagingConfig(MessagingServiceType.Kinesis);

    expect(config).toEqual({
      schema: { ...kinesisConnection },
      uiSchema: { ...COMMON_UI_SCHEMA },
    });
  });

  it('getMessagingConfig should return correct config for PubSub connector', () => {
    const config = getMessagingConfig(MessagingServiceType.PubSub);

    expect(config).toEqual({
      schema: { ...pubSubConnection },
      uiSchema: { ...COMMON_UI_SCHEMA },
    });
  });

  it('getMessagingConfig should return only common UI schema in config for invalid connectors', () => {
    const config = getMessagingConfig('' as MessagingServiceType);

    expect(config).toEqual({
      schema: {},
      uiSchema: { ...COMMON_UI_SCHEMA },
    });
  });
});

