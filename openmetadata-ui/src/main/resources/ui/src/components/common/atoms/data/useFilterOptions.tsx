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

import { useCallback, useEffect, useState } from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { getAggregationOptions } from '../../../../utils/ExploreUtils';
import { FilterField, FilterOptions } from '../types';

interface UseFilterOptionsProps {
  searchIndex: SearchIndex;
  filterFields: FilterField[];
}

export const useFilterOptions = ({
  searchIndex,
  filterFields,
}: UseFilterOptionsProps) => {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
  const [loading, setLoading] = useState(false);

  const processAggregationResult = useCallback(
    (
      result: unknown,
      processor?: (result: unknown) => unknown[]
    ): unknown[] => {
      if (result.status !== 'fulfilled') {
        return [];
      }

      if (processor) {
        return processor(result);
      }

      // Default processing for simple aggregations
      const buckets = Object.values(
        (result as any).value?.data?.aggregations || {}
      )[0] as unknown;
      if (!buckets?.buckets) {
        return [];
      }

      return (buckets as any)?.buckets?.map((bucket: any) => ({
        key: bucket.key,
        label: bucket.key,
        count: bucket.doc_count,
      }));
    },
    []
  );

  const fetchFilterOptions = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        filterFields.map((field) =>
          getAggregationOptions(
            searchIndex,
            field.aggregationField,
            '',
            JSON.stringify({}),
            false
          )
        )
      );

      // Process all results and batch update
      const newFilterOptions = filterFields.reduce((acc, field, index) => {
        acc[field.key] = processAggregationResult(
          results[index],
          field.processor
        );

        return acc;
      }, {} as FilterOptions);

      setFilterOptions(newFilterOptions);
    } catch (error) {
      // Failed to fetch filter options - continue with empty options
      // Reset all options on error
      const emptyOptions = filterFields.reduce(
        (acc, field) => ({ ...acc, [field.key]: [] }),
        {}
      );
      setFilterOptions(emptyOptions);
    } finally {
      setLoading(false);
    }
  }, [searchIndex, filterFields, processAggregationResult]);

  const searchFilterOptions = useCallback(
    async (fieldKey: string, searchTerm: string) => {
      const field = filterFields.find((f) => f.key === fieldKey);
      if (!field) {
        return;
      }

      if (!searchTerm.trim()) {
        fetchFilterOptions();

        return;
      }

      try {
        setLoading(true);
        const result = await getAggregationOptions(
          searchIndex,
          field.aggregationField,
          searchTerm,
          JSON.stringify({}),
          false
        );

        const processedOptions = processAggregationResult(
          { status: 'fulfilled', value: result },
          field.processor
        );

        setFilterOptions((prev) => ({
          ...prev,
          [fieldKey]: processedOptions,
        }));
      } catch (error) {
        // Failed to search filter options - keep existing options
        // Keep existing options on search error
      } finally {
        setLoading(false);
      }
    },
    [searchIndex, filterFields, processAggregationResult, fetchFilterOptions]
  );

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  return {
    filterOptions,
    loading,
    refetch: fetchFilterOptions,
    searchFilterOptions,
  };
};
