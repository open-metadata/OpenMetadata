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

import {
  AlertType,
  Effect,
  EventSubscription,
  InputType,
  PrefixCondition,
  ProviderType,
  SubscriptionCategory,
  SubscriptionType,
} from '../generated/events/eventSubscription';

export const mockAlertDetails: EventSubscription = {
  id: 'e8d4782b-9b5b-44e5-898c-4f6348d5579a',
  name: 'Test Alert',
  fullyQualifiedName: 'Test Alert',
  description: 'Testing alert description.',
  alertType: AlertType.Notification,
  filteringRules: {
    resources: ['table'],
    rules: [
      {
        name: 'filterByEventType',
        displayName: 'Event Type',
        fullyQualifiedName: 'eventSubscription.filterByEventType',
        description:
          'Event Filtering by Event Type like entityCreated, entityUpdated, etc.',
        effect: Effect.Include,
        condition: "matchAnyEventType({'entityRestored','entitySoftDeleted'})",
        arguments: ['eventTypeList'],
        inputType: InputType.Runtime,
        prefixCondition: PrefixCondition.And,
      },
      {
        name: 'filterByGeneralMetadataEvents',
        displayName: 'General Metadata Events',
        fullyQualifiedName: 'eventSubscription.filterByGeneralMetadataEvents',
        description: 'Event Filtering By General MetadataEvents',
        effect: Effect.Include,
        condition: "matchAnyFieldChange({'description', 'tags'})",
        arguments: [],
        inputType: InputType.None,
        prefixCondition: PrefixCondition.And,
      },
      {
        name: 'filterByOwnerName',
        displayName: 'Owner',
        fullyQualifiedName: 'eventSubscription.filterByOwnerName',
        description: 'Event Filtering By Owner of the Asset',
        effect: Effect.Include,
        condition: "matchAnyOwnerName({'aaron_johnson0'})",
        arguments: ['ownerNameList'],
        inputType: InputType.Runtime,
        prefixCondition: PrefixCondition.And,
      },
    ],
    actions: [],
  },
  destinations: [
    {
      id: '9ff358ac-53aa-43e3-b392-3f9ae888cca0',
      category: SubscriptionCategory.Admins,
      type: SubscriptionType.Email,
      timeout: 10,
      readTimeout: 12,
      enabled: true,
      config: {
        sendToAdmins: true,
      },
    },
    {
      id: 'ad724738-c2a2-440c-a259-81b6eb6c3698',
      category: SubscriptionCategory.Teams,
      type: SubscriptionType.Slack,
      timeout: 10,
      readTimeout: 12,
      enabled: true,
      config: {
        receivers: ['Accounting'],
      },
    },
    {
      id: '39f3e12c-2504-43d0-8d83-8dc62b6ac21b',
      category: SubscriptionCategory.External,
      type: SubscriptionType.GChat,
      timeout: 10,
      readTimeout: 12,
      enabled: true,
      config: {
        endpoint: 'https://test.slack.webhook.com',
      },
    },
  ],
  provider: ProviderType.User,
  input: {
    filters: [
      {
        name: 'filterByEventType',
        effect: Effect.Include,
        prefixCondition: PrefixCondition.And,
        arguments: [
          {
            name: 'eventTypeList',
            input: ['entityRestored', 'entitySoftDeleted'],
          },
        ],
      },
      {
        name: 'filterByGeneralMetadataEvents',
        effect: Effect.Include,
        prefixCondition: PrefixCondition.And,
        arguments: [],
      },
      {
        name: 'filterByOwnerName',
        effect: Effect.Include,
        prefixCondition: PrefixCondition.And,
        arguments: [
          {
            name: 'ownerNameList',
            input: ['aaron_johnson0'],
          },
        ],
      },
    ],
    actions: [
      {
        name: 'GetTestCaseStatusUpdates',
        effect: Effect.Include,
        prefixCondition: PrefixCondition.And,
        arguments: [
          {
            name: 'testResultList',
            input: ['Failed', 'Queued', 'Aborted'],
          },
        ],
      },
    ],
  },
};
