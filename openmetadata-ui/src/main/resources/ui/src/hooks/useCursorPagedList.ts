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
import { useCallback, useEffect, useRef, useState } from 'react';
import { LIST_PAGE_SIZE_OPTIONS } from '../constants/constants';
import { Paging } from '../generated/type/paging';
import { walkToAfterCursor } from '../utils/CursorPaging.utils';
import { showErrorToast } from '../utils/ToastUtils';
import { useSavedPageSize } from './paging/useSavedPageSize';

export interface CursorPageParams {
  after?: string;
  before?: string;
  limit: number;
}

// Cursors are kept for this many pages at most; past it a jump walks again
// (ADR:2026-10-16-cursor-paged-lists-jump-by-walking).
const MAX_CACHED_PAGES = 100;

const rememberPaging = (
  cache: Map<number, Paging>,
  pageNumber: number,
  pagePaging: Paging
) => {
  if (cache.size < MAX_CACHED_PAGES) {
    cache.set(pageNumber, pagePaging);
  }
};

/**
 * Page-number pagination over a cursor-paged list endpoint. Each loaded page's
 * paging is cached, so any page is reachable: forward uses page N-1's `after`
 * (fetching unvisited pages in between first), back uses page N+1's `before`,
 * and page 1 needs no cursor. A new `fetchPage` identity — e.g. a changed
 * filter — clears the cache and restarts from page 1.
 */
export const useCursorPagedList = <T>(
  fetchPage: (params: CursorPageParams) => Promise<{
    data: T[];
    paging: Paging;
  }>,
  pageSizeOptions: number[] = LIST_PAGE_SIZE_OPTIONS
) => {
  const { savedPageSize, savePageSize } = useSavedPageSize(pageSizeOptions);
  const [items, setItems] = useState<T[]>([]);
  const [paging, setPaging] = useState<Paging>({ total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(savedPageSize);
  const [isLoading, setIsLoading] = useState(true);
  // Only the latest request may write state: a slow earlier response (e.g. the
  // list before a filter flipped) must not overwrite the newer one.
  const latestRequest = useRef(0);
  // The paging each loaded page returned, so any page can be reached later:
  // page k's `after` opens page k+1 and its `before` opens page k-1.
  const pagingByPage = useRef(new Map<number, Paging>());
  // Bumped when the list restarts, so a walk or response that began against
  // the previous list never writes its cursors into the new cache.
  const listVersion = useRef(0);
  // Bumped on every page change, so a slow jump never overrides a later one.
  const latestNavigation = useRef(0);

  const load = useCallback(
    async (
      cursor?: Pick<CursorPageParams, 'after' | 'before'>,
      targetPage = 1
    ) => {
      const requestId = ++latestRequest.current;
      setIsLoading(true);
      try {
        const response = await fetchPage({ ...cursor, limit: pageSize });
        if (requestId === latestRequest.current) {
          rememberPaging(pagingByPage.current, targetPage, response.paging);
          setItems(response.data);
          setPaging(response.paging);
        }
      } catch (error) {
        if (requestId === latestRequest.current) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (requestId === latestRequest.current) {
          setIsLoading(false);
        }
      }
    },
    [fetchPage, pageSize]
  );

  useEffect(() => {
    listVersion.current++;
    pagingByPage.current.clear();
    setPage(1);
    void load();
  }, [load]);

  const onPageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      savePageSize(size);
    },
    [savePageSize]
  );

  const onPageChange = async (nextPage: number) => {
    // Each page change supersedes any earlier one still walking.
    const navigation = ++latestNavigation.current;
    if (nextPage === 1) {
      setPage(1);

      return load(undefined, 1);
    }
    const before =
      nextPage < page
        ? pagingByPage.current.get(nextPage + 1)?.before
        : undefined;
    if (before) {
      setPage(nextPage);

      return load({ before }, nextPage);
    }
    const version = listVersion.current;
    const isStale = () =>
      navigation !== latestNavigation.current ||
      version !== listVersion.current;
    setIsLoading(true);
    try {
      const after = await walkToAfterCursor({
        target: nextPage,
        pagingFor: (pageNumber) => pagingByPage.current.get(pageNumber),
        remember: (pageNumber, pagePaging) =>
          rememberPaging(pagingByPage.current, pageNumber, pagePaging),
        fetchPaging: async (cursor) =>
          (
            await fetchPage({ after: cursor, limit: pageSize })
          ).paging,
        isStale,
      });
      if (isStale()) {
        return undefined;
      }
      // No cursor: stay put rather than show the wrong rows under another
      // page number.
      if (!after) {
        setIsLoading(false);

        return undefined;
      }
      setPage(nextPage);

      return load({ after }, nextPage);
    } catch (error) {
      if (!isStale()) {
        setIsLoading(false);
        showErrorToast(error as AxiosError);
      }

      return undefined;
    }
  };

  return {
    items,
    isLoading,
    page,
    pageSize,
    totalPages: Math.ceil((paging.total ?? 0) / pageSize),
    showPagination:
      Boolean(paging.after || paging.before) ||
      paging.total > pageSizeOptions[0],
    onPageChange,
    onPageSizeChange,
  };
};
