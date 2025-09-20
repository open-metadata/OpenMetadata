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

import { useCallback } from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { getAggregationOptions } from '../../../../utils/ExploreUtils';
import { FilterField } from '../types';

/**
 * Fetches aggregation data from API for filter dropdowns
 *
 * @description
 * Pure API fetching hook that calls the aggregation endpoint to get
 * filter option data. Handles both initial fetch and search-within-filter.
 * Does not manage state - only makes API calls.
 *
 * @example
 * ```typescript
 * const fetchAggregation = useAggregationFetcher();
 * const result = await fetchAggregation(SearchIndex.DOMAIN, field, searchTerm);
 * ```
 *
 * @stability Stable - No external dependencies, pure function
 * @complexity Low - Single API call responsibility
 */
export const useAggregationFetcher = () => {
  const fetchAggregation = useCallback(
    async (searchIndex: SearchIndex, field: FilterField, searchTerm = '') => {
      return await getAggregationOptions(
        searchIndex,
        field.aggregationField,
        searchTerm,
        JSON.stringify({}),
        false
      );
    },
    [] // No dependencies - pure API call
  );

  return fetchAggregation;
};
