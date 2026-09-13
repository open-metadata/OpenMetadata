/*
 *  Copyright 2022 Collate.
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

import { uniqBy } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PAGE_SIZE_MEDIUM } from '../../constants/constants';
import { getKnowledgePageFields } from '../../constants/KnowledgeCenter.constant';
import { SearchIndex } from '../../enums/search.enum';
import { Paging } from '../../generated/type/paging';
import { KnowledgePage } from '../../interface/knowledge-center.interface';
import { getListKnowledgePages } from '../../rest/knowledgeCenterAPI';
import { searchQuery as fetchSearchResults } from '../../rest/searchAPI';

export const useKnowledgePageListing = (
  searchQuery: string | undefined,
  enabled: boolean
) => {
  const [knowledgePages, setKnowledgePages] = useState<KnowledgePage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>();
  const requestOrder = useRef(0);
  const offset = useRef(0);
  const pending = useRef(false);

  const fetchPage = useCallback(
    async (nextOffset: number) => {
      const request = ++requestOrder.current;
      pending.current = true;
      setError(undefined);
      if (nextOffset === 0) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      try {
        let data: KnowledgePage[];
        let nextPaging: Paging;
        if (searchQuery) {
          const response = await fetchSearchResults({
            query: searchQuery,
            searchIndex: SearchIndex.KNOWLEDGE_PAGE_INDEX,
            sortField: 'updatedAt',
            sortOrder: 'desc',
            pageSize: PAGE_SIZE_MEDIUM,
            pageNumber: nextOffset / PAGE_SIZE_MEDIUM + 1,
          });
          data = response.hits.hits.map((hit) => hit._source as KnowledgePage);
          nextPaging = { total: response.hits.total.value };
        } else {
          const response = await getListKnowledgePages({
            fields: getKnowledgePageFields(),
            limit: PAGE_SIZE_MEDIUM,
            offset: nextOffset,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
          });
          data = response.data;
          nextPaging = response.paging;
        }
        if (request !== requestOrder.current) {
          return;
        }
        offset.current = nextOffset;
        setKnowledgePages((previous) =>
          uniqBy(nextOffset > 0 ? [...previous, ...data] : data, 'id')
        );
        setHasMore(
          data.length > 0 && nextOffset + data.length < nextPaging.total
        );
      } catch (failure) {
        if (request === requestOrder.current) {
          setError(failure);
        }
      } finally {
        if (request === requestOrder.current) {
          pending.current = false;
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [searchQuery]
  );

  useEffect(() => {
    offset.current = 0;
    setKnowledgePages([]);
    setHasMore(false);
    setError(undefined);
    if (enabled) {
      void fetchPage(0);
    } else {
      pending.current = false;
      setIsLoading(false);
      setIsLoadingMore(false);
    }

    return () => {
      requestOrder.current++;
    };
  }, [enabled, fetchPage]);

  const fetchNextPage = useCallback(() => {
    const loading = pending.current || isLoading || isLoadingMore;
    if (!enabled || error || !hasMore) {
      return;
    }
    if (loading) {
      return;
    }

    return fetchPage(offset.current + PAGE_SIZE_MEDIUM);
  }, [enabled, error, hasMore, isLoading, isLoadingMore, fetchPage]);

  // `error` has to keep blocking fetchNextPage: the caller's sentinel effect
  // re-runs on every identity change of that callback, so an error that
  // cleared itself would be re-entered the moment the failed request settled
  // and would retry in a tight loop against a failing endpoint. Recovery is a
  // separate entry point the caller drives from a gesture instead, so one
  // failed page cannot freeze infinite scroll for the rest of the session.
  const clearPagingError = useCallback(() => {
    setError(undefined);
  }, []);

  return {
    knowledgePages,
    setKnowledgePages,
    isLoading,
    isLoadingMore,
    error,
    clearPagingError,
    fetchNextPage,
  };
};
