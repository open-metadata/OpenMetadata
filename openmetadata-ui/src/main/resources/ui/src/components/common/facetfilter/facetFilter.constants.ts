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

import { capitalize } from 'lodash';

const aggregationKeyToTitleMap: Record<string, string> = {
  serviceType: 'Service',
  'databaseSchema.name.keyword': 'Schema',
  'database.name.keyword': 'Database',
  'tier.tagFQN': 'Tier',
  'tags.tagFQN': 'Tag',
  'service.name.keyword': 'Service Name',
  entityType: 'Entity Type',
  'messageSchema.schemaFields.name': 'Schema Fields',
  'glossary.name': 'Glossary',
};

const aggregationKeyOrdering: Record<string, number> = {
  serviceType: 0,
  'tier.tagFQN': 1,
  'tags.tagFQN': 2,
  'service.name.keyword': 3,
  'database.name.keyword': 4,
  'databaseSchema.name.keyword': 5,
};

export const translateAggregationKeyToTitle: (key: string) => string = (
  key
) => {
  if (key in aggregationKeyToTitleMap) {
    return aggregationKeyToTitleMap[key];
  }

  return key
    .split('.')
    .filter((ss) => ss !== 'keyword')
    .reduce((prev, curr) => `${prev} ${capitalize(curr)}`, '');
};

export const compareAggregationKey: (key1: string, key2: string) => number = (
  key1,
  key2
) => {
  const key1Val =
    key1 in aggregationKeyOrdering ? aggregationKeyOrdering[key1] : 1000;
  const key2Val =
    key2 in aggregationKeyOrdering ? aggregationKeyOrdering[key2] : 1000;

  return key1Val - key2Val;
};
