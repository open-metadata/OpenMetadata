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
import { useCallback, useRef } from 'react';
import { Paging } from '../../generated/type/paging';
import { walkToAfterCursor } from '../../utils/CursorPaging.utils';

// Same cap as useCursorPagedList (ADR:2026-10-16-cursor-paged-lists-jump-by-walking).
const MAX_CACHED_PAGES = 100;

export type PageCursor = { after?: string; before?: string };

/**
 * Page-number jumps over a cursor-paged list whose rows the caller loads. The
 * caller records each loaded page's paging with `remember`; `cursorFor` then
 * returns the cursor that opens a target page: none for page 1, page N+1's
 * `before` going back, page N-1's `after` going forward (walking unvisited
 * pages in between). `reset` forgets them when the list restarts.
 */
export const useCursorPageJump = (
  fetchPaging: (after: string) => Promise<Paging>
) => {
  const pagingByPage = useRef(new Map<number, Paging>());
  const latestJump = useRef(0);

  const remember = useCallback((page: number, pagePaging: Paging) => {
    if (pagingByPage.current.size < MAX_CACHED_PAGES) {
      pagingByPage.current.set(page, pagePaging);
    }
  }, []);

  const reset = useCallback(() => {
    latestJump.current++;
    pagingByPage.current.clear();
  }, []);

  /** Undefined when the page cannot be reached, or a newer jump replaced this one. */
  const cursorFor = useCallback(
    async (
      target: number,
      currentPage: number
    ): Promise<PageCursor | undefined> => {
      const jump = ++latestJump.current;
      if (target <= 1) {
        return {};
      }
      const before =
        target < currentPage
          ? pagingByPage.current.get(target + 1)?.before
          : undefined;
      if (before) {
        return { before };
      }
      const after = await walkToAfterCursor({
        target,
        pagingFor: (page) => pagingByPage.current.get(page),
        remember,
        fetchPaging,
        isStale: () => jump !== latestJump.current,
      });

      return after && jump === latestJump.current ? { after } : undefined;
    },
    [fetchPaging, remember]
  );

  return { cursorFor, remember, reset };
};
