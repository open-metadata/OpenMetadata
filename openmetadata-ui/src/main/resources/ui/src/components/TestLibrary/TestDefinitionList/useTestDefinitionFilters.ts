/*
 *  Copyright 2026 Collate.
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
import { useCallback, useMemo } from 'react';
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import {
  TEST_DEFINITION_DEFAULT_QUICK_FILTERS,
  TEST_DEFINITION_FILTERS,
} from '../../../constants/TestDefinition.constants';
import { UsePagingInterface } from '../../../hooks/paging/usePaging';
import { useTableFilters } from '../../../hooks/useTableFilters';
import { mapUrlValueToOption } from '../../../utils/TestDefinitionUtils';
import { ExploreQuickFilterField } from '../../Explore/ExplorePage.interface';

export interface UseTestDefinitionFiltersProps {
  handlePageChange: UsePagingInterface['handlePageChange'];
}

/**
 * Owns the FILTERS concern: the URL-backed quick filters (via
 * {@link useTableFilters}), the derived {@link ExploreQuickFilterField}
 * descriptors and every handler that mutates them. The paging reset that each
 * filter change triggers is injected as {@link handlePageChange} so the paging
 * bag stays owned by the parent. The raw {@link urlParams} are returned so the
 * data concern can drive its refetch effect off the same source.
 */
export const useTestDefinitionFilters = ({
  handlePageChange,
}: UseTestDefinitionFiltersProps) => {
  const { filters: urlParams, setFilters: updateUrlParams } = useTableFilters<{
    entityType?: string;
    testPlatforms?: string;
    q?: string;
  }>({
    entityType: undefined,
    testPlatforms: undefined,
    q: undefined,
  });

  const searchQuery = urlParams.q ?? '';

  const urlFilters = useMemo(() => {
    const filters: Record<string, string[]> = {};

    TEST_DEFINITION_DEFAULT_QUICK_FILTERS.forEach((key) => {
      const paramValue = urlParams[key as keyof typeof urlParams];
      if (paramValue) {
        const values = String(paramValue).split(',').filter(Boolean);
        filters[key] = values.length > 0 ? [values[0]] : [];
      }
    });

    return filters;
  }, [urlParams]);

  const parsedFilters = useMemo<ExploreQuickFilterField[]>(() => {
    return TEST_DEFINITION_FILTERS.map((filter) => ({
      ...filter,
      value:
        urlFilters[filter.key]?.map((v) =>
          mapUrlValueToOption(v, filter.options)
        ) || [],
    }));
  }, [urlFilters]);

  const applyUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      updateUrlParams(updates);

      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
    },
    [updateUrlParams, handlePageChange]
  );

  const handleFilterChange = useCallback(
    (filters: ExploreQuickFilterField[]) => {
      const filterUpdates: Record<string, string | null> = {};

      TEST_DEFINITION_DEFAULT_QUICK_FILTERS.forEach((key) => {
        filterUpdates[key] = null;
      });

      filters.forEach((filter) => {
        const values = filter.value?.map((v) => v.key) || [];
        if (values.length > 0) {
          filterUpdates[filter.key] = values.join(',');
        }
      });

      applyUrlParams(filterUpdates);
    },
    [applyUrlParams]
  );

  const setSingleFilter = useCallback(
    (key: string, value?: string) => {
      applyUrlParams({ [key]: value || null });
    },
    [applyUrlParams]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      applyUrlParams({ q: value || null });
    },
    [applyUrlParams]
  );

  // "Clear all" is the single exit from an empty result set, so it has to drop
  // the search term too - leaving it behind keeps the list empty and the button
  // reads as broken. Cleared in the same update as the quick filters:
  // useTableFilters merges each call against the URL as it is now, so a second
  // call in the same tick would be built from the pre-navigation search string
  // and put the quick filters back.
  const clearAllFilters = useCallback(() => {
    const filterUpdates: Record<string, string | null> = { q: null };

    TEST_DEFINITION_DEFAULT_QUICK_FILTERS.forEach((key) => {
      filterUpdates[key] = null;
    });

    applyUrlParams(filterUpdates);
  }, [applyUrlParams]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(searchQuery.trim()) ||
      Object.values(urlFilters).some((value) => value.length > 0),
    [urlFilters, searchQuery]
  );

  return {
    urlParams,
    urlFilters,
    parsedFilters,
    searchQuery,
    handleFilterChange,
    handleSearchChange,
    setSingleFilter,
    clearAllFilters,
    hasActiveFilters,
  };
};
