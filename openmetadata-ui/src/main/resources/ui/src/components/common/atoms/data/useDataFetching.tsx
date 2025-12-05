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

import { AxiosError } from 'axios';
import { useCallback, useState } from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { Aggregations } from '../../../../interface/search.interface';
import { searchQuery } from '../../../../rest/searchAPI';
import { domainBuildESQuery } from '../../../../utils/DomainUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';

export interface DataFetchingConfig<T> {
  searchIndex: SearchIndex;
  baseFilter?: string;
  pageSize?: number;
  transform?: (data: any) => T[];
}

export interface DataFetchingResult<T> {
  entities: T[];
  loading: boolean;
  error: Error | null;
  totalEntities: number;
  aggregations: Aggregations | null;
  refetch: () => void;
  searchEntities: (
    page: number,
    searchTerm: string,
    filters: Record<string, string[]>
  ) => Promise<void>;
}

export const useDataFetching = <T extends { id: string }>(
  config: DataFetchingConfig<T>
): DataFetchingResult<T> => {
  const [entities, setEntities] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalEntities, setTotalEntities] = useState(0);
  const [aggregations, setAggregations] = useState<Aggregations | null>(null);

  const { searchIndex, baseFilter = '', pageSize = 10, transform } = config;

  // Default transform function
  const defaultTransform = useCallback(
    (data: any) => data.hits?.hits?.map((hit: any) => hit._source) || [],
    []
  );

  const transformData = transform || defaultTransform;

  const buildESQuery = useCallback(
    (filters: Record<string, string[]>): Record<string, unknown> =>
      domainBuildESQuery(filters, baseFilter),
    [baseFilter]
  );

  // Main search function with comprehensive handling
  const searchEntities = useCallback(
    async (
      page: number,
      searchTerm = '',
      filters: Record<string, string[]> = {}
    ) => {
      try {
        setLoading(true);
        setError(null);

        const validPage = Math.max(1, page);

        // Build Elasticsearch query with filters
        const esQuery = buildESQuery(filters);

        const response = await searchQuery({
          query: searchTerm || '',
          pageNumber: validPage,
          pageSize,
          queryFilter: esQuery,
          searchIndex,
          includeDeleted: false,
        });

        // Process response
        const transformedEntities = transformData(response);
        const total = response?.hits?.total?.value || 0;
        const responseAggregations = response?.aggregations || null;

        // Update state
        setEntities(transformedEntities);
        setTotalEntities(total);
        setAggregations(responseAggregations);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Search failed'));
        setEntities([]);
        setTotalEntities(0);
        setAggregations(null);
        showErrorToast(err as AxiosError);
      } finally {
        setLoading(false);
      }
    },
    [searchIndex, pageSize, transformData, buildESQuery]
  );

  // Refetch function
  const refetch = useCallback(() => {
    searchEntities(1, '', {});
  }, [searchEntities]);

  return {
    entities,
    loading,
    error,
    totalEntities,
    aggregations,
    refetch,
    searchEntities,
  };
};
