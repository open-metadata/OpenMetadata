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

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UrlState, UrlStateConfig, UrlStateHook } from '../types';

export const useUrlState = (config: UrlStateConfig): UrlStateHook => {
  const [searchParams, setSearchParams] = useSearchParams();

  const { searchKey = 'q', filterKeys, pageKey = 'page' } = config;

  const urlState: UrlState = useMemo(() => {
    const searchQuery = searchParams.get(searchKey) || '';
    const currentPage = parseInt(searchParams.get(pageKey) || '1', 10);

    const filters: Record<string, string[]> = {};
    filterKeys.forEach((key) => {
      const filterValue = searchParams.get(key);
      filters[key] = filterValue ? filterValue.split(',').filter(Boolean) : [];
    });

    return {
      searchQuery,
      filters,
      currentPage,
    };
  }, [searchParams, searchKey, pageKey, filterKeys]);

  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((current) => {
        const newParams = new URLSearchParams(current);

        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === '' || value === undefined) {
            newParams.delete(key);
          } else {
            newParams.set(key, value);
          }
        });

        return newParams;
      });
    },
    [setSearchParams]
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      const updates: Record<string, string | null> = {
        [searchKey]: query || null,
        [pageKey]: '1',
      };
      updateUrlParams(updates);
    },
    [searchKey, pageKey, updateUrlParams]
  );

  const setFilters = useCallback(
    (key: string, values: string[]) => {
      const updates: Record<string, string | null> = {
        [key]: values.length > 0 ? values.join(',') : null,
        [pageKey]: '1',
      };
      updateUrlParams(updates);
    },
    [pageKey, updateUrlParams]
  );

  const setCurrentPage = useCallback(
    (page: number) => {
      const updates: Record<string, string | null> = {
        [pageKey]: page > 1 ? page.toString() : null,
      };
      updateUrlParams(updates);
    },
    [pageKey, updateUrlParams]
  );

  const resetFilters = useCallback(() => {
    const updates: Record<string, string | null> = {};
    filterKeys.forEach((key) => {
      updates[key] = null;
    });
    updates[pageKey] = null;
    updateUrlParams(updates);
  }, [filterKeys, pageKey, updateUrlParams]);

  const resetAll = useCallback(() => {
    const updates: Record<string, string | null> = {
      [searchKey]: null,
      [pageKey]: null,
    };
    filterKeys.forEach((key) => {
      updates[key] = null;
    });
    updateUrlParams(updates);
  }, [searchKey, pageKey, filterKeys, updateUrlParams]);

  return {
    urlState,
    setSearchQuery,
    setFilters,
    setCurrentPage,
    resetFilters,
    resetAll,
  };
};
