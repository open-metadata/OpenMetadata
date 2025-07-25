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

import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchIndex } from '../enums/search.enum';
import { Domain } from '../generated/entity/domains/domain';
import { SearchResponse } from '../interface/search.interface';
import { searchQuery } from '../rest/searchAPI';
import { buildEntityTableQueryFilter } from '../utils/EntityTableUtils';
import { showErrorToast } from '../utils/ToastUtils';
import { useTableFilters } from './useTableFilters';

export interface EntitySearchFilters {
  owners: string[];
  glossaryTerms: string[];
  domainTypes: string[];
  tags: string[];
  [key: string]: string | boolean | string[] | null | undefined;
}

export interface UseDynamicEntitySearchProps {
  searchIndex: SearchIndex;
  pageSize?: number;
  enableFilters?: boolean;
  enableSearch?: boolean;
  debounceMs?: number;
  baseQuery?: string;
  baseQueryFilter?: Record<string, unknown>;
}

export interface DynamicSearchResult<T> {
  data: T[];
  loading: boolean;
  total: number;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: EntitySearchFilters;
  setFilters: (filters: EntitySearchFilters) => void;
  refetch: () => void;
}

const initialFilters: EntitySearchFilters = {
  owners: [],
  glossaryTerms: [],
  domainTypes: [],
  tags: [],
};

export function useDynamicEntitySearch<T = Domain>({
  searchIndex,
  pageSize = 25,
  enableFilters = true,
  enableSearch = true,
  debounceMs = 300,
  baseQuery = '',
  baseQueryFilter,
}: UseDynamicEntitySearchProps): DynamicSearchResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTermState] = useState('');

  // Use URL-synced filters if filters are enabled
  const { filters: urlFilters, setFilters: setUrlFilters } =
    useTableFilters<EntitySearchFilters>(
      enableFilters ? initialFilters : initialFilters
    );

  const filters = enableFilters ? urlFilters : initialFilters;
  const noOpSetFilters = (_filters: EntitySearchFilters): void => {
    // No-op function for when filters are disabled
  };
  const setFilters = enableFilters ? setUrlFilters : noOpSetFilters;

  // Build Elasticsearch query filter from current filters
  const queryFilter = useMemo(() => {
    const filterQuery = buildEntityTableQueryFilter(filters, searchIndex);

    // Combine with base query filter if provided
    if (baseQueryFilter && Object.keys(baseQueryFilter).length > 0) {
      return {
        query: {
          bool: {
            must: [
              filterQuery?.query || { match_all: {} },
              baseQueryFilter?.query || baseQueryFilter,
            ].filter(Boolean),
          },
        },
      };
    }

    return filterQuery;
  }, [filters, baseQueryFilter, searchIndex]);

  // Create a stable reference to the latest values
  const latestValues = useRef({
    searchIndex,
    baseQuery,
    enableSearch,
    queryFilter,
    pageSize,
  });

  // Update the ref with latest values
  useEffect(() => {
    latestValues.current = {
      searchIndex,
      baseQuery,
      enableSearch,
      queryFilter,
      pageSize,
    };
  });

  // Create stable debounced function that only gets created once
  const debouncedFetchRef = useRef<ReturnType<typeof debounce>>();

  // Initialize debounced function only once
  useEffect(() => {
    debouncedFetchRef.current = debounce(async (searchValue: string) => {
      setLoading(true);
      try {
        const {
          searchIndex: currentSearchIndex,
          baseQuery: currentBaseQuery,
          enableSearch: currentEnableSearch,
          queryFilter: currentQueryFilter,
          pageSize: currentPageSize,
        } = latestValues.current;

        let query = currentBaseQuery;
        if (currentEnableSearch && searchValue.trim()) {
          query = query
            ? `${currentBaseQuery} AND *${searchValue.trim()}*`
            : `*${searchValue.trim()}*`;
        }

        const response: SearchResponse<SearchIndex> = await searchQuery({
          query: query || '*',
          searchIndex: currentSearchIndex,
          queryFilter: currentQueryFilter,
          pageSize: currentPageSize,
          pageNumber: 1,
          includeDeleted: false,
          trackTotalHits: true,
        });

        const hits = response.hits.hits.map((hit) => hit._source) as T[];
        setData(hits);
        setTotal(response.hits.total.value || 0);
      } catch (error) {
        showErrorToast(error as AxiosError, 'Error fetching entity data');
        setData([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    // Cleanup function
    return () => {
      if (debouncedFetchRef.current) {
        debouncedFetchRef.current.cancel();
      }
    };
  }, [debounceMs]); // Only recreate if debounceMs changes

  // Regular fetch function for initial load and refetch
  const fetchData = useCallback(
    async (searchValue: string = searchTerm) => {
      setLoading(true);
      try {
        let query = baseQuery;
        if (enableSearch && searchValue.trim()) {
          query = query
            ? `${baseQuery} AND *${searchValue.trim()}*`
            : `*${searchValue.trim()}*`;
        }

        const response: SearchResponse<SearchIndex> = await searchQuery({
          query: query || '*',
          searchIndex,
          queryFilter,
          pageSize,
          pageNumber: 1,
          includeDeleted: false,
          trackTotalHits: true,
        });

        const hits = response.hits.hits.map((hit) => hit._source) as T[];
        setData(hits);
        setTotal(response.hits.total.value || 0);
      } catch (error) {
        showErrorToast(error as AxiosError, 'Error fetching entity data');
        setData([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [searchIndex, queryFilter, pageSize, baseQuery, enableSearch, searchTerm]
  );

  // Set search term and trigger debounced fetch
  const setSearchTerm = useCallback((term: string) => {
    setSearchTermState(term);
    if (debouncedFetchRef.current) {
      debouncedFetchRef.current(term);
    }
  }, []);

  // Refetch function
  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Initial fetch and filter change effects
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    total,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    refetch,
  };
}

// Helper function to extract filter options from aggregation buckets (kept for reference)
function extractOptionsFromBuckets(
  buckets: Array<{ key: string; doc_count: number }>
) {
  if (!buckets || !Array.isArray(buckets)) {
    return [];
  }

  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.key,
    count: bucket.doc_count || 0,
  }));
}
