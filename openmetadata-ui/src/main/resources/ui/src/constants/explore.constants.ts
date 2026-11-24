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

export const DISPLAY_NAME_KEYWORD_FIELD = 'displayName.keyword';

export const INITIAL_SORT_FIELD = 'totalVotes';
export const TAGS_INITIAL_SORT_FIELD = DISPLAY_NAME_KEYWORD_FIELD;
export const TAGS_INITIAL_SORT_ORDER = SORT_ORDER.ASC;
export const TIER_FQN_KEY = 'tier.tagFQN';
export const TAG_FQN_KEY = 'tags.tagFQN';

export const MAX_RESULT_HITS = 10000;

export const SUPPORTED_EMPTY_FILTER_FIELDS = [
  EntityFields.OWNERS,
  EntityFields.DOMAINS,
  EntityFields.DATA_PRODUCT,
  EntityFields.TIER,
  EntityFields.TAG,
  EntityFields.CERTIFICATION,
];

export const NOT_INCLUDE_AGGREGATION_QUICK_FILTER = [
  EntityType.INGESTION_PIPELINE,
];

export const tableSortingFields: SortingField[] = [
  {
    name: 'label.popularity',
    value: 'totalVotes',
  },
  {
    name: 'label.name',
    value: DISPLAY_NAME_KEYWORD_FIELD,
  },
  {
    name: 'label.weekly-usage',
    value: 'usageSummary.weeklyStats.count',
  },
  { name: 'label.relevance', value: '_score' },
  {
    name: 'label.last-updated',
    value: 'updatedAt',
  },
];

export const entitySortingFields = [
  {
    name: 'label.popularity',
    value: 'totalVotes',
  },
  {
    name: 'label.name',
    value: DISPLAY_NAME_KEYWORD_FIELD,
  },
  { name: 'label.relevance', value: '_score' },
  {
    name: 'label.last-updated',
    value: 'updatedAt',
  },
];

export const tagSortingFields = [
  {
    name: 'label.name',
    value: DISPLAY_NAME_KEYWORD_FIELD,
  },
  { name: 'label.relevance', value: '_score' },
  {
    name: 'label.last-updated',
    value: 'updatedAt',
  },
];

export const columnSortingFields: SortingField[] = [
  {
    name: 'label.data-type',
    value: 'dataType',
  },
  {
    name: 'label.table',
    value: 'table.name.keyword',
  },
  {
    name: 'label.name',
    value: DISPLAY_NAME_KEYWORD_FIELD,
  },
  { name: 'label.relevance', value: '_score' },
  {
    name: 'label.last-updated',
    value: 'updatedAt',
  },
];

export type SortOrderIcon = 'barsDesc' | 'barsAsc' | 'az' | 'za' | 'search';

export interface SortOrderOption {
  order: SORT_ORDER;
  label: string;
  icon: SortOrderIcon;
}

const ALPHABETICAL_ORDER_OPTIONS: SortOrderOption[] = [
  { order: SORT_ORDER.ASC, label: 'label.a-to-z', icon: 'az' },
  { order: SORT_ORDER.DESC, label: 'label.z-to-a', icon: 'za' },
];

// The first option of each field is the order applied when that field is picked.
export const SORT_ORDER_OPTIONS: Record<string, SortOrderOption[]> = {
  totalVotes: [
    {
      order: SORT_ORDER.DESC,
      label: 'label.most-votes-first',
      icon: 'barsDesc',
    },
    {
      order: SORT_ORDER.ASC,
      label: 'label.fewest-votes-first',
      icon: 'barsAsc',
    },
  ],
  [DISPLAY_NAME_KEYWORD_FIELD]: ALPHABETICAL_ORDER_OPTIONS,
  'table.name.keyword': ALPHABETICAL_ORDER_OPTIONS,
  dataType: ALPHABETICAL_ORDER_OPTIONS,
  _score: [
    { order: SORT_ORDER.DESC, label: 'label.best-match-first', icon: 'search' },
  ],
  updatedAt: [
    { order: SORT_ORDER.DESC, label: 'label.newest-first', icon: 'barsDesc' },
    { order: SORT_ORDER.ASC, label: 'label.oldest-first', icon: 'barsAsc' },
  ],
  'usageSummary.weeklyStats.count': [
    {
      order: SORT_ORDER.DESC,
      label: 'label.most-used-first',
      icon: 'barsDesc',
    },
    {
      order: SORT_ORDER.ASC,
      label: 'label.least-used-first',
      icon: 'barsAsc',
    },
  ],
};

export const COMMON_FILTERS_FOR_DIFFERENT_TABS = [
  'owner.displayName',
  'tags.tagFQN',
];

export const FAILED_TO_FIND_INDEX_ERROR = 'Failed to to find index';

export const ES_EXCEPTION_SHARDS_FAILED = 'reason=all shards failed';

export const SEARCH_INDEXING_APPLICATION = 'SearchIndexingApplication';

// Explore's advanced search, as the Elasticsearch filter its URL carries: one group of one rule.
export const INCOMPLETE_DESCRIPTION_ADVANCE_SEARCH_FILTER = {
  query: {
    bool: {
      must: [
        { bool: { must: [{ term: { descriptionStatus: 'INCOMPLETE' } }] } },
      ],
    },
  },
};

export const NO_OWNER_ADVANCE_SEARCH_FILTER = {
  query: {
    bool: {
      must: [
        {
          bool: {
            must: [
              { bool: { must_not: { exists: { field: 'ownerDisplayName' } } } },
            ],
          },
        },
      ],
    },
  },
};
