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

import { startCase } from 'lodash';
import { EventFilter, Status } from '../../generated/entity/events/webhook';

export const CREATE_EVENTS_DEFAULT_VALUE = {
  eventType: 'entityCreated',
  entities: ['*', 'table', 'topic', 'dashboard', 'pipeline'],
};

export const UPDATE_EVENTS_DEFAULT_VALUE = {
  eventType: 'entityUpdated',
  entities: ['*', 'table', 'topic', 'dashboard', 'pipeline'],
};

export const DELETE_EVENTS_DEFAULT_VALUE = {
  eventType: 'entityDeleted',
  entities: ['*', 'table', 'topic', 'dashboard', 'pipeline'],
};

export const EVENT_FILTERS_DEFAULT_VALUE = {
  entityType: 'all',
  filters: [
    {
      eventType: 'entityCreated',
      fields: ['all'],
    },
    {
      eventType: 'entityUpdated',
      fields: ['all'],
    },
    {
      eventType: 'entityDeleted',
      fields: ['all'],
    },
    {
      eventType: 'entitySoftDeleted',
      fields: ['all'],
    },
  ],
} as EventFilter;

export const EVENT_FILTER_FORM_INITIAL_VALUE = {
  table: true,
  'table-tree': ['all'],
  topic: true,
  'topic-tree': ['all'],
  dashboard: true,
  'dashboard-tree': ['all'],
  pipeline: true,
  'pipeline-tree': ['all'],
  mlmodel: true,
  'mlmodel-tree': ['all'],
};

export const statuses = [
  {
    label: startCase(Status.Disabled),
    value: Status.Disabled,
  },
  {
    label: startCase(Status.Active),
    value: Status.Active,
  },
  {
    label: startCase(Status.Failed),
    value: Status.Failed,
  },
  {
    label: startCase(Status.AwaitingRetry),
    value: Status.AwaitingRetry,
  },
  {
    label: startCase(Status.RetryLimitReached),
    value: Status.RetryLimitReached,
  },
];

export const Entities = {
  table: 'Tables',
  topic: 'Topics',
  dashboard: 'Dashboards',
  pipeline: 'Pipelines',
  mlmodel: 'ML Models',
} as Record<string, string>;
