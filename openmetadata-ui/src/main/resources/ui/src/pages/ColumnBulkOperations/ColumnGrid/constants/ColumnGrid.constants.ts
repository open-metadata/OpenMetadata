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

export const COLUMN_GRID_FILTERS: ExploreQuickFilterField[] = [
  {
    label: i18n.t('label.service'),
    key: EntityFields.SERVICE,
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
    label: i18n.t('label.data-type'),
    key: 'dataType',
    hideCounts: true,
    hideSearchBar: true,
    options: [
      { key: 'STRING', label: 'STRING' },
      { key: 'VARCHAR', label: 'VARCHAR' },
      { key: 'INT', label: 'INT' },
      { key: 'BIGINT', label: 'BIGINT' },
      { key: 'FLOAT', label: 'FLOAT' },
      { key: 'DOUBLE', label: 'DOUBLE' },
      { key: 'BOOLEAN', label: 'BOOLEAN' },
      { key: 'DATE', label: 'DATE' },
      { key: 'TIMESTAMP', label: 'TIMESTAMP' },
      { key: 'DECIMAL', label: 'DECIMAL' },
      { key: 'NUMERIC', label: 'NUMERIC' },
      { key: 'TEXT', label: 'TEXT' },
      { key: 'CHAR', label: 'CHAR' },
      { key: 'BINARY', label: 'BINARY' },
      { key: 'ARRAY', label: 'ARRAY' },
      { key: 'MAP', label: 'MAP' },
      { key: 'STRUCT', label: 'STRUCT' },
      { key: 'JSON', label: 'JSON' },
      { key: 'UUID', label: 'UUID' },
    ],
  },
  {
    label: i18n.t('label.metadata-status'),
    hideCounts: true,
    hideSearchBar: true,
    key: 'metadataStatus',
    options: [
      { key: 'MISSING', label: 'Missing' },
      { key: 'INCOMPLETE', label: 'Incomplete' },
      { key: 'INCONSISTENT', label: 'Inconsistent' },
      { key: 'COMPLETE', label: 'Complete' },
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
