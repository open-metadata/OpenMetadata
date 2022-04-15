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

import { cloneDeep, isUndefined } from 'lodash';
import { COMMON_UI_SCHEMA } from '../constants/services.const';
import {
  MessagingConnection,
  MessagingServiceType,
} from '../generated/entity/services/messagingService';
import kafkaConnection from '../jsons/connectionSchemas/connections/messaging/kafkaConnection.json';

export const getBrokers = (config: MessagingConnection['config']) => {
  let retVal: string | undefined;

  // Change it to switch case if more than 1 conditions arise
  if (config?.type === MessagingServiceType.Kafka) {
    retVal = config.bootstrapServers;
  }

  return !isUndefined(retVal) ? retVal : '--';
};

export const getMessagingConfig = (config: MessagingConnection['config']) => {
  let schema = {};
  const uiSchema = { ...COMMON_UI_SCHEMA };
  if (config?.type === MessagingServiceType.Kafka) {
    schema = kafkaConnection;
  }

  return cloneDeep({ schema, uiSchema });
};
