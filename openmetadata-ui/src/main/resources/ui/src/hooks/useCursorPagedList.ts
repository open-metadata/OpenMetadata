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

/**
 * Page-number pagination over a cursor-paged list endpoint. Moving forward
 * follows `after`, moving back follows `before`, so (like the other settings
 * lists) only adjacent pages are reachable by cursor. A new `fetchPage`
 * identity — e.g. a changed filter — restarts from page 1.
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

  const load = useCallback(
    async (cursor?: Pick<CursorPageParams, 'after' | 'before'>) => {
      const requestId = ++latestRequest.current;
      setIsLoading(true);
      try {
        const response = await fetchPage({ ...cursor, limit: pageSize });
        if (requestId === latestRequest.current) {
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
    setPage(1);
    load();
  }, [load]);

  const onPageChange = (nextPage: number) => {
    const cursorType = nextPage > page ? 'after' : 'before';
    setPage(nextPage);
    load({ [cursorType]: paging[cursorType] });
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
