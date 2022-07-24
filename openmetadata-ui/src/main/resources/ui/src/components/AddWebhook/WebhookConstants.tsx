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
