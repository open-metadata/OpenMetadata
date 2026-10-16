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
import { PAGE_SIZE_BASE } from '../constants/constants';
import { Paging } from '../generated/type/paging';
import { showErrorToast } from '../utils/ToastUtils';

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
  }>
) => {
  const [items, setItems] = useState<T[]>([]);
  const [paging, setPaging] = useState<Paging>({ total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_BASE);
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

  // The `after` cursor that opens `target`, fetching any skipped pages in
  // between so a jump (e.g. 1 -> 4) lands on the right page. Undefined when
  // the list ran out of pages or restarted mid-walk.
  const resolveAfter = async (target: number) => {
    const version = listVersion.current;
    let known = target - 1;
    while (known > 1 && !pagingByPage.current.has(known)) {
      known--;
    }
    let knownPaging = pagingByPage.current.get(known);
    while (known < target - 1 && knownPaging?.after) {
      const response = await fetchPage({
        after: knownPaging.after,
        limit: pageSize,
      });
      if (version !== listVersion.current) {
        return undefined;
      }
      known++;
      rememberPaging(pagingByPage.current, known, response.paging);
      knownPaging = response.paging;
    }

    return known === target - 1 ? knownPaging?.after : undefined;
  };

  const onPageChange = async (nextPage: number) => {
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
    try {
      const after = await resolveAfter(nextPage);
      // No cursor, or the list restarted while walking: stay put rather than
      // show the wrong rows under another page number.
      if (!after || version !== listVersion.current) {
        return undefined;
      }
      setPage(nextPage);

      return load({ after }, nextPage);
    } catch (error) {
      showErrorToast(error as AxiosError);

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
      Boolean(paging.after || paging.before) || paging.total > PAGE_SIZE_BASE,
    onPageChange,
    onPageSizeChange: setPageSize,
  };
};
