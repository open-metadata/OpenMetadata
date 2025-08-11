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
  EventType,
  Status,
  TypedEvent,
} from '../generated/events/api/typedEvent';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../generated/events/eventSubscription';

export const mockExternalDestinationOptions = Object.values(
  SubscriptionType
).filter((value) => value !== SubscriptionType.ActivityFeed);

export const mockTaskInternalDestinationOptions = [
  SubscriptionCategory.Owners,
  SubscriptionCategory.Assignees,
];

export const mockNonTaskInternalDestinationOptions = Object.values(
  SubscriptionCategory
).filter(
  (value) =>
    value !== SubscriptionCategory.External &&
    value !== SubscriptionCategory.Assignees
);

export const mockTypedEvent1: TypedEvent = {
  status: Status.Successful,
  data: [
    {
      eventType: EventType.EntityCreated,
      entityId: 'entityId1',
      userName: 'user1',
      previousVersion: 0.1,
      currentVersion: 0.2,
    },
  ],
  timestamp: 1730871300446,
};

export const mockTypedEvent2: TypedEvent = {
  status: Status.Failed,
  data: [
    {
      changeEvent: {
        eventType: EventType.EntityUpdated,
        entityId: 'entityId2',
        entityType: 'table',
        id: '23471210-cfec-49f9-ad02-898e11621121',
        userName: 'user2',
        previousVersion: 0.2,
        currentVersion: 0.3,
        timestamp: 1730871300446,
      },
      reason: 'Some reason',
      source: 'Some source',
      failingSubscriptionId: 'subscriptionId1',
    },
  ],
  timestamp: 1730871300446,
};

export const mockTypedEvent3: TypedEvent = {
  status: Status.Unprocessed,
  data: [
    {
      eventType: EventType.EntityDeleted,
      entityId: 'entityId3',
      userName: 'user3',
      previousVersion: 0.3,
      currentVersion: 0.4,
      timestamp: 1730871300446,
    },
  ],
  timestamp: 1730871300446,
};

export const mockTypedEvent4: TypedEvent = {
  status: 'unknown' as Status,
  data: [
    {
      eventType: EventType.EntityCreated,
      entityId: 'entityId4',
      userName: 'user4',
      previousVersion: 0.4,
      currentVersion: 0.5,
    },
  ],
  timestamp: 1730871300446,
};
