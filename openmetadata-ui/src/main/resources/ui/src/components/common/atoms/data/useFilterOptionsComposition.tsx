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

import { useCallback, useEffect } from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { FilterField } from '../types';
import { useAggregationFetcher } from './useAggregationFetcher';
import { useAggregationProcessor } from './useAggregationProcessor';
import { useFilterLoadingState } from './useFilterLoadingState';
import { useFilterOptionsState } from './useFilterOptionsState';

interface UseFilterOptionsCompositionProps {
  searchIndex: SearchIndex;
  filterFields: FilterField[];
}

/**
 * Composes filter option micro hooks into complete filter options system
 *
 * @description
 * Combines multiple micro hooks to provide complete filter options functionality:
 * - State management (useFilterOptionsState)
 * - API fetching (useAggregationFetcher)
 * - Data processing (useAggregationProcessor)
 * - Loading management (useFilterLoadingState)
 *
 * Each micro hook has a single responsibility, making this composition
 * easy to understand, test, and debug.
 *
 * @param config.searchIndex - Elasticsearch index to fetch aggregations from
 * @param config.filterFields - Array of fields to create filter options for
 *
 * @example
 * ```typescript
 * const { filterOptions, loading, searchFilterOptions } = useFilterOptionsComposition({
 *   searchIndex: SearchIndex.DOMAIN,
 *   filterFields: [COMMON_FILTER_FIELDS.owners, COMMON_FILTER_FIELDS.tags]
 * });
 * ```
 *
 * @stability Stable - Composes stable micro hooks
 * @complexity Low - Simple composition pattern
 */
export const useFilterOptionsComposition = ({
  searchIndex,
  filterFields,
}: UseFilterOptionsCompositionProps) => {
  // Micro hooks - each with single responsibility
  const processResult = useAggregationProcessor();
  const fetchAggregation = useAggregationFetcher();
  const { loading, startLoading, stopLoading } = useFilterLoadingState();
  const { filterOptions, setFilterOptions, updateFilterField } =
    useFilterOptionsState();

  // Fetch all filter options (initial load)
  const fetchAllFilterOptions = useCallback(async () => {
    startLoading();
    try {
      const results = await Promise.allSettled(
        filterFields.map((field) => fetchAggregation(searchIndex, field))
      );

      const newFilterOptions = filterFields.reduce((acc, field, index) => {
        acc[field.key] = processResult(results[index], field.processor);

        return acc;
      }, {} as Record<string, unknown[]>);

      setFilterOptions(newFilterOptions);
    } catch (error) {
      // Reset to empty options on error
      setFilterOptions({});
    } finally {
      stopLoading();
    }
  }, [
    searchIndex,
    filterFields,
    fetchAggregation,
    processResult,
    startLoading,
    stopLoading,
    setFilterOptions,
  ]);

  // Search within specific filter field
  const searchFilterOptions = useCallback(
    async (fieldKey: string, searchTerm: string) => {
      const field = filterFields.find((f) => f.key === fieldKey);
      if (!field) {
        return;
      }

      if (!searchTerm.trim()) {
        fetchAllFilterOptions();

        return;
      }

      startLoading();
      try {
        const result = await fetchAggregation(searchIndex, field, searchTerm);
        const processedOptions = processResult(
          { status: 'fulfilled', value: result },
          field.processor
        );
        updateFilterField(fieldKey, processedOptions);
      } catch (error) {
        // Keep existing options on search error
      } finally {
        stopLoading();
      }
    },
    [
      filterFields,
      searchIndex,
      fetchAggregation,
      processResult,
      updateFilterField,
      startLoading,
      stopLoading,
      fetchAllFilterOptions,
    ]
  );

  // Load filter options on mount
  useEffect(() => {
    fetchAllFilterOptions();
  }, [fetchAllFilterOptions]);

  return {
    filterOptions,
    loading,
    refetch: fetchAllFilterOptions,
    searchFilterOptions,
  };
};
