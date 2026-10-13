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
import { Operation } from 'fast-json-patch';
import { InlineAlertProps } from '../components/common/InlineAlert/InlineAlert.interface';
import { NotificationTemplate } from '../generated/entity/events/notificationTemplate';
import { User } from '../generated/entity/teams/user';
import { CreateEventSubscription } from '../generated/events/api/createEventSubscription';
import {
  Destination,
  EventSubscription,
  SubscriptionCategory,
  SubscriptionType,
  Webhook,
} from '../generated/events/eventSubscription';

export interface ModifiedWebhookConfig extends Webhook {
  headers?: { key: string; value: string }[];
  queryParams?: { key: string; value: string }[];
}

export interface ModifiedDestination extends Destination {
  destinationType: SubscriptionType | SubscriptionCategory;
  config?: ModifiedWebhookConfig;
}

export interface ModifiedEventSubscription
  extends Omit<EventSubscription, 'notificationTemplate'> {
  destinations: ModifiedDestination[];
  notificationTemplate?: string | EventSubscription['notificationTemplate'];
  timeout: number;
  readTimeout: number;
}

export interface ModifiedCreateEventSubscription
  extends Omit<CreateEventSubscription, 'notificationTemplate'> {
  notificationTemplate?:
    | string
    | CreateEventSubscription['notificationTemplate'];
  customNotificationTemplateData?: NotificationTemplate;
  destinations: ModifiedDestination[];
  timeout: number;
  readTimeout: number;
}

export interface AddAlertPageLoadingState {
  alerts: boolean;
  functions: boolean;
  templates: boolean;
}

export interface HandleAlertSaveProps {
  initialData?: EventSubscription;
  data: ModifiedCreateEventSubscription;
  createAlertAPI: (
    alert: CreateEventSubscription
  ) => Promise<EventSubscription>;
  updateAlertAPI: (id: string, data: Operation[]) => Promise<EventSubscription>;
  afterSaveAction: (fqn: string) => Promise<void>;
  setInlineAlertDetails: (alertDetails?: InlineAlertProps | undefined) => void;
  fqn?: string;
  currentUser?: User;
}
