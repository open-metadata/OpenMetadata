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

import { ExploreQuickFilterField } from '../../../../components/Explore/ExplorePage.interface';
import { SearchDropdownOption } from '../../../../components/SearchDropdown/SearchDropdown.interface';
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import i18n from '../../../../utils/i18next/LocalUtil';

export const COLUMN_TAG_FIELD = 'columnTags';
export const COLUMN_GLOSSARY_FIELD = 'columnGlossaryTerms';

export const RECENTLY_UPDATED_HIGHLIGHT_DURATION_MS = 1000;

export const MAX_REFETCH_CHAIN_PAGES = 25;
export const SCROLL_TO_ROW_MAX_RETRIES = 3;
export const SCROLL_TO_ROW_RETRY_DELAY_MS = 50;

export const DEFAULT_VISIBLE_FILTER_KEYS = [
  EntityFields.SERVICE,
  EntityFields.ENTITY_TYPE,
  'metadataStatus',
];

export const ADDITIONAL_FILTER_KEYS = [
  EntityFields.SERVICE_TYPE,
  EntityFields.DOMAINS,
  COLUMN_TAG_FIELD,
  COLUMN_GLOSSARY_FIELD,
];

export const COLUMN_GRID_FILTERS: ExploreQuickFilterField[] = [
  {
    label: i18n.t('label.service'),
    key: EntityFields.SERVICE,
    hideCounts: true,
  },
  {
    label: i18n.t('label.service-type'),
    key: EntityFields.SERVICE_TYPE,
    hideCounts: true,
  },
  {
    label: i18n.t('label.domain-plural'),
    key: EntityFields.DOMAINS,
    hideCounts: true,
  },
  {
    label: i18n.t('label.asset-type'),
    key: EntityFields.ENTITY_TYPE,
    hideCounts: true,
    hideSearchBar: true,
    options: [
      { key: 'table', label: 'Table' },
      { key: 'dashboardDataModel', label: 'Dashboard Data Model' },
      { key: 'topic', label: 'Topic' },
      { key: 'container', label: 'Container' },
      { key: 'searchIndex', label: 'Search Index' },
    ],
  },
  {
    label: i18n.t('label.tag-plural'),
    key: COLUMN_TAG_FIELD,
    hideCounts: true,
    searchKey: 'columns.tags.tagFQN',
  },
  {
    label: i18n.t('label.glossary-term-plural'),
    key: COLUMN_GLOSSARY_FIELD,
    hideCounts: true,
    searchKey: 'columns.tags.tagFQN',
  },
  {
    label: i18n.t('label.metadata-status'),
    hideCounts: true,
    hideSearchBar: true,
    key: 'metadataStatus',
    dropdownClassName: 'column-bulk-operations-metadata-dropdown',
    options: [
      {
        key: 'MISSING',
        label: i18n.t('label.missing'),
        description: i18n.t('message.metadata-status-missing-description'),
      },
      {
        key: 'INCOMPLETE',
        label: i18n.t('label.incomplete'),
        description: i18n.t('message.metadata-status-incomplete-description'),
      },
      {
        key: 'INCONSISTENT',
        label: i18n.t('label.inconsistent'),
        description: i18n.t('message.metadata-status-inconsistent-description'),
      },
      {
        key: 'COMPLETE',
        label: i18n.t('label.complete'),
        description: i18n.t('message.metadata-status-complete-description'),
      },
    ],
  },
];

/**
 * Helper function to convert string filter values to SearchDropdownOption objects
 * @param filterKey - The filter key to look up in COLUMN_GRID_FILTERS
 * @param filterValues - Array of string values from URL state
 * @returns Array of SearchDropdownOption objects
 */
export const convertFilterValuesToOptions = (
  filterKey: string,
  filterValues: string[]
): SearchDropdownOption[] => {
  return filterValues.map((v) => ({
    key: v,
    label: v,
  }));
};
