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

import { SearchIndex } from '../../../../enums/search.enum';
import { FilterField } from '../types';
import { useFilterOptionsComposition } from './useFilterOptionsComposition';

interface UseFilterOptionsProps {
  searchIndex: SearchIndex;
  filterFields: FilterField[];
}

/**
 * Complete filter options system for dropdown filters
 *
 * @description
 * Provides complete filter options functionality by composing multiple
 * micro hooks. This is the main interface for filter options that
 * components should use.
 *
 * Internally composed of:
 * - useAggregationProcessor: Data transformation
 * - useAggregationFetcher: API calls
 * - useFilterLoadingState: Loading management
 * - useFilterOptionsState: State management
 * - useFilterOptionsComposition: Orchestration
 *
 * @param config.searchIndex - Elasticsearch index to fetch aggregations from
 * @param config.filterFields - Array of fields to create filter options for
 *
 * @example
 * ```typescript
 * const { filterOptions, loading, searchFilterOptions } = useFilterOptions({
 *   searchIndex: SearchIndex.DOMAIN,
 *   filterFields: [COMMON_FILTER_FIELDS.owners]
 * });
 * ```
 *
 * @stability Stable - Composes stable micro hooks
 * @complexity Low - Simple composition interface
 */
export const useFilterOptions = ({
  searchIndex,
  filterFields,
}: UseFilterOptionsProps) => {
  return useFilterOptionsComposition({
    searchIndex,
    filterFields,
  });
};
