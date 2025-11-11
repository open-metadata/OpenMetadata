/*
 *  Copyright 2024 Collate.
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

import { CreateEventSubscription } from '../../generated/events/api/createEventSubscription';
import {
  Destination,
  EventSubscription,
  SubscriptionCategory,
  SubscriptionType,
  Webhook,
} from '../../generated/events/eventSubscription';

export interface ModifiedWebhookConfig extends Webhook {
  headers?: { key: string; value: string }[];
  queryParams?: { key: string; value: string }[];
}

export interface ModifiedDestination extends Destination {
  destinationType: SubscriptionType | SubscriptionCategory;
  config?: ModifiedWebhookConfig;
}

export interface ModifiedEventSubscription extends EventSubscription {
  destinations: ModifiedDestination[];
  timeout: number;
  readTimeout: number;
}

export interface ModifiedCreateEventSubscription
  extends CreateEventSubscription {
  destinations: ModifiedDestination[];
  timeout: number;
  readTimeout: number;
}
