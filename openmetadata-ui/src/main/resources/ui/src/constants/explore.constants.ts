/*
 *  Copyright 2023 Collate.
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

import { SortingField } from '../components/Explore/SortingDropDown';
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { SORT_ORDER } from '../enums/common.enum';
import { EntityType } from '../enums/entity.enum';
import i18n from '../utils/i18next/LocalUtil';

export const INITIAL_SORT_FIELD = 'totalVotes';
export const TAGS_INITIAL_SORT_FIELD = 'name.keyword';
export const TAGS_INITIAL_SORT_ORDER = SORT_ORDER.ASC;
export const TIER_FQN_KEY = 'tier.tagFQN';
export const TAG_FQN_KEY = 'tags.tagFQN';

export const MAX_RESULT_HITS = 10000;

export const SUPPORTED_EMPTY_FILTER_FIELDS = [
  EntityFields.OWNERS,
  EntityFields.DOMAIN,
  EntityFields.TIER,
  EntityFields.TAG,
  EntityFields.CERTIFICATION,
];

export const NOT_INCLUDE_AGGREGATION_QUICK_FILTER = [
  EntityType.INGESTION_PIPELINE,
];

// as it is used only in unit tests it's not needed for translation
export const tableSortingFields: SortingField[] = [
  {
    name: i18n.t('label.popularity'),
    value: 'totalVotes',
  },
  {
    name: i18n.t('label.name'),
    value: 'name.keyword',
  },
  {
    name: i18n.t('label.weekly-usage'),
    value: 'usageSummary.weeklyStats.count',
  },
  { name: i18n.t('label.relevance'), value: '_score' },
  {
    name: i18n.t('label.last-updated'),
    value: 'updatedAt',
  },
];

export const entitySortingFields = [
  {
    name: i18n.t('label.popularity'),
    value: 'totalVotes',
  },
  {
    name: i18n.t('label.name'),
    value: 'name.keyword',
  },
  { name: i18n.t('label.relevance'), value: '_score' },
  {
    name: i18n.t('label.last-updated'),
    value: 'updatedAt',
  },
];

export const tagSortingFields = [
  {
    name: i18n.t('label.name'),
    value: 'name.keyword',
  },
  { name: i18n.t('label.relevance'), value: '_score' },
  {
    name: i18n.t('label.last-updated'),
    value: 'updatedAt',
  },
];

export const COMMON_FILTERS_FOR_DIFFERENT_TABS = [
  'owner.displayName',
  'tags.tagFQN',
];

export const FAILED_TO_FIND_INDEX_ERROR = 'Failed to to find index';

export const ES_EXCEPTION_SHARDS_FAILED = 'reason=all shards failed';

export const SEARCH_INDEXING_APPLICATION = 'SearchIndexingApplication';

export const INCOMPLETE_DESCRIPTION_ADVANCE_SEARCH_FILTER = {
  id: 'descriptionID1',
  type: 'group',
  properties: { conjunction: 'AND', not: false },
  children1: {
    descriptionID2: {
      type: 'group',
      properties: { conjunction: 'AND', not: false },
      children1: {
        descriptionID3: {
          type: 'rule',
          properties: {
            field: 'descriptionStatus',
            operator: 'select_equals',
            value: ['INCOMPLETE'],
            valueSrc: ['value'],
            operatorOptions: null,
            valueType: ['select'],
            asyncListValues: [
              {
                key: 'INCOMPLETE',
                value: 'INCOMPLETE',
                children: 'Incomplete',
              },
            ],
          },
          id: 'descriptionID3',
          path: ['descriptionID1', 'descriptionID2', 'descriptionID3'],
        },
      },
      id: 'descriptionID2',
      path: ['descriptionID1', 'descriptionID2'],
    },
  },
  path: ['descriptionID1'],
};

export const NO_OWNER_ADVANCE_SEARCH_FILTER = {
  id: 'ownerID1',
  type: 'group',
  properties: { conjunction: 'AND', not: false },
  children1: {
    ownerID3: {
      type: 'group',
      properties: { conjunction: 'AND', not: false },
      children1: {
        ownerID2: {
          type: 'rule',
          properties: {
            field: 'owners.displayName.keyword',
            operator: 'is_null',
            value: [],
            valueSrc: [],
            operatorOptions: null,
            valueType: [],
          },
          id: 'ownerID2',
          path: ['ownerID1', 'ownerID3', 'ownerID2'],
        },
      },
      id: 'ownerID3',
      path: ['ownerID1', 'ownerID3'],
    },
  },
  path: ['ownerID1'],
};
