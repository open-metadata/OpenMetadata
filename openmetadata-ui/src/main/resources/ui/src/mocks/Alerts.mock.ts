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

import { PagingResponse } from 'Models';
import {
  EventType,
  Status,
  TypedEvent,
} from '../generated/events/api/typedEvent';
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
    actions: [
      {
        name: 'GetTestCaseStatusUpdates',
        displayName: 'Get Test Case Status Updates',
        fullyQualifiedName: 'eventSubscription.GetTestCaseStatusUpdates',
        description: 'Get Status Updates Test Cases',
        effect: Effect.Include,
        condition: "matchTestResult({'Failed'})",
        arguments: ['testResultList'],
        inputType: InputType.Runtime,
        prefixCondition: PrefixCondition.And,
      },
    ],
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

export const mockFailedEventData: TypedEvent = {
  status: Status.Failed,
  data: [
    {
      failingSubscriptionId: 'a0f4ffc3-cea1-4eb6-ae59-aa4687c2b063',
      changeEvent: {
        id: '6e56e9c8-bf9f-425b-8bcb-faa32c875bd8',
        eventType: EventType.EntityUpdated,
        entityType: 'table',
        entityId: '23471210-cfec-49f9-ad02-898e11621121',
        previousVersion: 0.1,
        currentVersion: 0.3,
        userName: 'admin',
        timestamp: 1730968041783,
        changeDescription: {
          fieldsAdded: [
            {
              name: 'owners',
              newValue:
                '[{"id":"ae458aa2-a162-48d6-977e-006d868829cf","type":"user","name":"aaron_johnson0","fullyQualifiedName":"aaron_johnson0","displayName":"Aaron Johnson","deleted":false}]',
            },
          ],
          fieldsUpdated: [],
          fieldsDeleted: [],
          previousVersion: 0.2,
        },
        entity:
          '{"id":"ec9c9ae5-ed82-4c4e-b2b1-a603940cbe0a","name":"Glue","fullyQualifiedName":"Glue","serviceType":"Glue","deleted":false}',
      },
      reason:
        'Failed to publish event of destination type Slack due to Failed to publish event of destination type Slack due to testing dummy failed event  ',
      source: 'SUBSCRIBER',
      timestamp: 1730968048221,
    },
  ],
  timestamp: 1730871300446,
};

export const MOCK_ALERT_RECENT_EVENTS: TypedEvent[] = [
  mockFailedEventData,
  {
    status: Status.Unprocessed,
    data: [
      {
        id: '328322ca-e9ab-46f4-8f9a-d380046d6e8c',
        eventType: EventType.EntityCreated,
        entityType: 'databaseService',
        entityId: 'ec9c9ae5-ed82-4c4e-b2b1-a603940cbe0a',
        previousVersion: 0.1,
        currentVersion: 0.1,
        userName: 'admin',
        timestamp: 1730871300272,
        entity:
          '{"id":"ec9c9ae5-ed82-4c4e-b2b1-a603940cbe0a","name":"Glue","fullyQualifiedName":"Glue","serviceType":"Glue","deleted":false}',
      },
    ],
    timestamp: 1730871300272,
  },
  {
    status: Status.Failed,
    data: [
      {
        id: 'ec51eae4-450b-4fc8-a33b-d2ad31b23258',
        eventType: EventType.EntityCreated,
        entityType: 'databaseService',
        entityId: 'c731e5e6-087b-416f-b133-f718d28ebc63',
        previousVersion: 0.1,
        currentVersion: 0.1,
        userName: 'admin',
        timestamp: 1730871300446,
        entity:
          '{"id":"ec9c9ae5-ed82-4c4e-b2b1-a603940cbe0a","name":"Glue","fullyQualifiedName":"Glue","serviceType":"Glue","deleted":false}',
      },
    ],
    timestamp: 1730871300446,
  },
  {
    status: Status.Successful,
    data: [
      {
        id: 'ee307ce2-4d47-428e-a859-cd69838cbc7e',
        eventType: EventType.EntityCreated,
        entityType: 'databaseService',
        entityId: '8239ce14-38f9-4715-a38d-00aee96b2d7a',
        previousVersion: 0.1,
        currentVersion: 0.1,
        userName: 'admin',
        timestamp: 1730871300505,
        entity:
          '{"id":"ec9c9ae5-ed82-4c4e-b2b1-a603940cbe0a","name":"Glue","fullyQualifiedName":"Glue","serviceType":"Glue","deleted":false}',
      },
    ],
    timestamp: 1730871300505,
  },
  {
    status: Status.Successful,
    data: [
      {
        id: 'a9f7317b-0c82-4c13-8058-d871b3916d69',
        eventType: EventType.EntityCreated,
        entityType: 'messagingService',
        entityId: '9dd47ad1-5e44-4233-b6c2-0f290e5436db',
        previousVersion: 0.1,
        currentVersion: 0.1,
        userName: 'admin',
        timestamp: 1730871300632,
        entity:
          '{"id":"ec9c9ae5-ed82-4c4e-b2b1-a603940cbe0a","name":"Glue","fullyQualifiedName":"Glue","serviceType":"Glue","deleted":false}',
      },
    ],
    timestamp: 1730871300632,
  },
  {
    status: Status.Successful,
    data: [
      {
        id: '236c992e-5cba-409f-9554-e051c4a413cb',
        eventType: EventType.EntityCreated,
        entityType: 'dashboardService',
        entityId: '2ffb0c03-8ede-4b43-acec-8da12ebb52ad',
        previousVersion: 0.1,
        currentVersion: 0.1,
        userName: 'admin',
        timestamp: 1730871300743,
        entity:
          '{"id":"ec9c9ae5-ed82-4c4e-b2b1-a603940cbe0a","name":"Glue","fullyQualifiedName":"Glue","serviceType":"Glue","deleted":false}',
      },
    ],
    timestamp: 1730871300743,
  },
];

export const mockAlertEventDiagnosticCounts = {
  totalEventsCount: 13,
  pendingEventsCount: 3,
  successfulEventsCount: 9,
  failedEventsCount: 1,
};

export const MOCK_TYPED_EVENT_LIST_RESPONSE: PagingResponse<TypedEvent[]> = {
  data: MOCK_ALERT_RECENT_EVENTS,
  paging: {
    offset: 0,
  },
};

export const mockDiagnosticData = {
  latestOffset: 100,
  currentOffset: 80,
  startingOffset: 0,
  successfulEventsCount: 75,
  failedEventsCount: 5,
  relevantUnprocessedEventsCount: 10,
  totalUnprocessedEventsCount: 20,
  hasProcessedAllEvents: true,
};

export const mockEmptyDiagnosticData = {
  latestOffset: 0,
  currentOffset: 0,
  startingOffset: 0,
  successfulEventsCount: 0,
  failedEventsCount: 0,
  relevantUnprocessedEventsCount: 0,
  totalUnprocessedEventsCount: 0,
  hasProcessedAllEvents: false,
};
