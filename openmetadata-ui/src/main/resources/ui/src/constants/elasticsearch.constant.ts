/*
 *  Copyright 2022 Collate
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

export const ELASTIC_SEARCH_INDEX_ENTITIES = [
  {
    value: 'table',
    label: 'Table',
  },
  {
    value: 'topic',
    label: 'Topic',
  },
  {
    value: 'dashboard',
    label: 'Dashboard',
  },
  {
    value: 'pipeline',
    label: 'Pipeline',
  },
  {
    value: 'mlmodel',
    label: 'ML Model',
  },
  {
    value: 'user',
    label: 'User',
  },
  {
    value: 'team',
    label: 'Team',
  },
  {
    value: 'glossaryTerm',
    label: 'Glossary Term',
  },
  {
    value: 'tag',
    label: 'Tag',
  },
];

export const ELASTIC_SEARCH_INITIAL_VALUES = {
  entities: [
    'table',
    'topic',
    'dashboard',
    'pipeline',
    'mlmodel',
    'user',
    'team',
    'glossaryTerm',
    'tag',
  ],
  batchSize: 100,
  flushIntervalInSec: 30,
  recreateIndex: false,
};

export const RECREATE_INDEX_OPTIONS = [
  {
    label: 'Yes',
    value: true,
  },
  {
    label: 'No',
    value: false,
  },
];
