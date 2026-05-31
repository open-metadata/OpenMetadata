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

import { cloneDeep, isUndefined } from 'lodash';
import { COMMON_UI_SCHEMA } from '../constants/ServiceUISchema.constant';
import {
  MessagingConnection,
  MessagingServiceType,
} from '../generated/entity/services/messagingService';

type SchemaModule =
  | { default: Record<string, unknown> }
  | Record<string, unknown>;
type SchemaLoader = () => Promise<SchemaModule>;

const messagingSchemaLoaders: Partial<
  Record<MessagingServiceType, SchemaLoader>
> = {
  [MessagingServiceType.Kafka]: () =>
    import(
      '../jsons/connectionSchemas/connections/messaging/kafkaConnection.json'
    ),
  [MessagingServiceType.Redpanda]: () =>
    import(
      '../jsons/connectionSchemas/connections/messaging/redpandaConnection.json'
    ),
  [MessagingServiceType.CustomMessaging]: () =>
    import(
      '../jsons/connectionSchemas/connections/messaging/customMessagingConnection.json'
    ),
  [MessagingServiceType.Kinesis]: () =>
    import(
      '../jsons/connectionSchemas/connections/messaging/kinesisConnection.json'
    ),
  [MessagingServiceType.PubSub]: () =>
    import(
      '../jsons/connectionSchemas/connections/messaging/pubSubConnection.json'
    ),
};

const resolveSchemaModule = (mod: SchemaModule): Record<string, unknown> => {
  const maybeDefault = (mod as { default?: Record<string, unknown> }).default;

  return maybeDefault ?? (mod as Record<string, unknown>);
};

export const getBrokers = (config: MessagingConnection['config']) => {
  let retVal: string | undefined;

  if (config?.type === MessagingServiceType.Kafka) {
    retVal = config.bootstrapServers;
  }

  return isUndefined(retVal) ? '--' : retVal;
};

const SCHEMA_REGISTRY_SUFFIX_UI_SCHEMA = {
  schemaRegistryTopicSuffixName: {
    'ui:emptyValue': '',
  },
};

export const getMessagingConfig = async (type: MessagingServiceType) => {
  const loader = messagingSchemaLoaders[type];
  let schema: Record<string, unknown> = {};
  const uiSchema: Record<string, unknown> = { ...COMMON_UI_SCHEMA };

  if (loader) {
    const mod = await loader();
    schema = resolveSchemaModule(mod);

    if (
      type === MessagingServiceType.Kafka ||
      type === MessagingServiceType.Redpanda
    ) {
      Object.assign(uiSchema, SCHEMA_REGISTRY_SUFFIX_UI_SCHEMA);
    }
  }

  return cloneDeep({ schema, uiSchema });
};
