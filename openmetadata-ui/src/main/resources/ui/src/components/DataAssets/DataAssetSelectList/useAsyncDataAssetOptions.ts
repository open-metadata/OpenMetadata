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
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PAGE_SIZE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { Paging } from '../../../generated/type/paging';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityReferenceUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  DataAssetOption,
  FetchOptionsResponse,
} from '../DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { UseAsyncDataAssetOptionsParams } from './DataAssetPicker.interface';

export const useAsyncDataAssetOptions = ({
  isOpen,
  searchIndex,
  queryFilter,
  debounceTimeout,
}: UseAsyncDataAssetOptionsParams) => {
  const isFetchingMore = useRef(false);
  // Opening the list and typing both start a search; a slower earlier
  // response must not overwrite the results of the latest one.
  const latestRequest = useRef(0);
  const loadedQuery = useRef<{
    query: string;
    fetcher: (query: string, page: number) => Promise<FetchOptionsResponse>;
  }>();
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<DataAssetOption[]>([]);
  const [searchText, setSearchText] = useState('');

  // Stabilize queryFilter by value so inline object literals from callers don't
  // cause fetchOptions/loadOptions to change identity on every render.

  const stableQueryFilter = useMemo(
    () => queryFilter,
    [JSON.stringify(queryFilter)]
  );

  const fetchOptions = useCallback(
    async (
      searchQueryParam: string,
      page: number
    ): Promise<FetchOptionsResponse> => {
      const response = await searchQuery({
        query: searchQueryParam ? `*${searchQueryParam}*` : '*',
        pageNumber: page,
        pageSize: PAGE_SIZE,
        searchIndex,
        queryFilter: stableQueryFilter ?? {
          query: { bool: { must_not: [{ match: { isBot: true } }] } },
        },
      });

      const hits = response.hits.hits;
      const total = response.hits.total.value;

      const data = hits.map(({ _source }) => {
        const entityName = getEntityName(_source);
        const entityRef = getEntityReferenceFromEntity(
          _source as EntityReference,
          _source.entityType as EntityType
        );

        return {
          label: entityName,
          value: _source.fullyQualifiedName,
          reference: { ...entityRef },
          displayName: entityName,
          name: _source.name,
          id: _source.id,
        };
      });

      return { data, paging: { total } };
    },
    [searchIndex, stableQueryFilter]
  );

  const loadOptions = useCallback(
    async (query: string) => {
      // Reopening the list asks for the same query again; reuse what is shown.
      const loaded = loadedQuery.current;
      if (loaded?.query === query && loaded.fetcher === fetchOptions) {
        return;
      }
      const request = ++latestRequest.current;
      // Keep the current results on screen until the new ones arrive, so the
      // list does not flash an empty state between searches.
      setIsLoading(true);
      try {
        const res = await fetchOptions(query, 1);
        if (request !== latestRequest.current) {
          return;
        }
        setOptions(res.data);
        setSearchText(query);
        setPaging(res.paging);
        setCurrentPage(1);
        loadedQuery.current = { query, fetcher: fetchOptions };
      } catch (error) {
        if (request === latestRequest.current) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (request === latestRequest.current) {
          setIsLoading(false);
        }
      }
    },
    [fetchOptions]
  );

  const debouncedLoad = useMemo(
    () => debounce((q: string) => loadOptions(q), debounceTimeout),
    [loadOptions, debounceTimeout]
  );

  useEffect(() => {
    if (!isOpen) {
      debouncedLoad.cancel();
    }
  }, [debouncedLoad, isOpen]);

  // Separate from the effect above: its cleanup would also run when the list
  // opens, cancelling the search typed into a closed combobox.
  useEffect(() => () => debouncedLoad.cancel(), [debouncedLoad]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchText(value);
      debouncedLoad(value);
    },
    [debouncedLoad]
  );

  const handleScroll = useCallback(
    async (e: React.UIEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const nearBottom = el.scrollTop + el.offsetHeight >= el.scrollHeight - 20;
      if (
        nearBottom &&
        options.length < (paging.total ?? 0) &&
        !isFetchingMore.current
      ) {
        isFetchingMore.current = true;
        const request = latestRequest.current;
        try {
          const res = await fetchOptions(searchText, currentPage + 1);
          if (request !== latestRequest.current) {
            return;
          }
          setOptions((prev) => [...prev, ...res.data]);
          setPaging(res.paging);
          setCurrentPage((prev) => prev + 1);
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          isFetchingMore.current = false;
        }
      }
    },
    [options.length, paging.total, searchText, currentPage, fetchOptions]
  );

  return {
    options,
    isLoading,
    searchText,
    totalCount: paging.total ?? 0,
    loadOptions,
    handleSearchChange,
    handleScroll,
  };
};
