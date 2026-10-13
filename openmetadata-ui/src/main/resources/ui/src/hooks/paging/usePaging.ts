/*
 *  Copyright 2023 Collate.
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
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
  pagingObject,
} from '../../constants/constants';
import { CursorType } from '../../enums/pagination.enum';
import { Paging } from '../../generated/type/paging';
import { useCurrentUserPreferences } from '../currentUserStore/useCurrentUserStore';
import { useTableFilters } from '../useTableFilters';

type FilterState = Record<
  string,
  string | boolean | string[] | null | undefined
>;

interface CursorState {
  cursorType: CursorType | null;
  cursorValue?: string;
}

interface PagingUrlParams {
  cursorType?: CursorType;
  cursorValue?: string;
  currentPage?: string;
  pageSize?: number;
}

export interface UsePagingInterface {
  paging: Paging;
  handlePagingChange: Dispatch<SetStateAction<Paging>>;
  currentPage: number;
  handlePageChange: (
    page: number | ((page: number) => number),
    cursorData?: CursorState,
    pageSize?: number
  ) => void;
  pageSize: number;
  handlePageSizeChange: (page: number) => void;
  showPagination: boolean;
  pagingCursor: PagingUrlParams;
}

/**
 * The sizes every page on the app-wide scale offers, and therefore the only ones `globalPageSize`
 * may hold: it is read by pages that declare no options of their own, so a size from some page's
 * bespoke scale would land in a picker with no matching entry.
 */
const GLOBAL_PAGE_SIZES = new Set([
  PAGE_SIZE_BASE,
  PAGE_SIZE_MEDIUM,
  PAGE_SIZE_LARGE,
]);

/**
 * @param defaultPageSize where to start when the URL carries no size; falls back to the app-wide
 *   `globalPageSize` preference.
 * @param pageSizeOptions the sizes this page's picker offers. Pass them when the page is not on
 *   the app-wide scale: a size from the shared URL param or preference is reconciled to this set.
 *   Pass a stable reference (a module constant) — a fresh array each render re-runs the sync
 *   effect below, which is wasted work rather than a bug, since its updates bail on equal values.
 */
export const usePaging = (
  defaultPageSize?: number,
  pageSizeOptions?: number[]
): UsePagingInterface => {
  const {
    preferences: { globalPageSize },
    setPreference,
  } = useCurrentUserPreferences();

  // A caller that declares no options accepts any size, so an absent list allows everything.
  const fallbackPageSize = defaultPageSize ?? globalPageSize;
  const processedPageSize =
    pageSizeOptions && !pageSizeOptions.includes(fallbackPageSize)
      ? pageSizeOptions[0]
      : fallbackPageSize;

  const { filters: urlParams, setFilters: updateUrlParams } = useTableFilters({
    cursorType: undefined,
    cursorValue: undefined,
    currentPage: String(INITIAL_PAGING_VALUE),
    pageSize: String(processedPageSize),
  });

  // Both sources this can come from are shared — one `pageSize` query param (and app mode keeps
  // every visited route mounted against it) plus one app-wide preference — so either can hand a
  // page a size its picker has no option for, which renders as an unselectable placeholder.
  const urlPageSize = Number(urlParams.pageSize) || processedPageSize;
  const resolvedPageSize =
    pageSizeOptions && !pageSizeOptions.includes(urlPageSize)
      ? processedPageSize
      : urlPageSize;

  const initialCurrentPage =
    Number(urlParams.currentPage) || INITIAL_PAGING_VALUE;

  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [currentPage, setCurrentPage] = useState<number>(initialCurrentPage);
  const [pageSize, setPageSize] = useState<number>(resolvedPageSize);

  // Keep pagination in sync when filters or other controls update paging params directly in the URL.
  useEffect(() => {
    const nextCurrentPage =
      Number(urlParams.currentPage) || INITIAL_PAGING_VALUE;

    setCurrentPage((currentPage) =>
      currentPage === nextCurrentPage ? currentPage : nextCurrentPage
    );
    setPageSize((pageSize) =>
      pageSize === resolvedPageSize ? pageSize : resolvedPageSize
    );
  }, [resolvedPageSize, urlParams.currentPage]);

  const pagingCursorUrlParams: PagingUrlParams = useMemo(
    () => ({
      cursorType: urlParams.cursorType,
      cursorValue: urlParams.cursorValue,
      currentPage: urlParams.currentPage,
      pageSize: resolvedPageSize,
    }),
    [
      urlParams.cursorType,
      urlParams.cursorValue,
      urlParams.currentPage,
      resolvedPageSize,
    ]
  );

  // A page on its own scale keeps its size to itself. Persisting a 24 here would hand it to every
  // page that reads the preference instead of declaring options, where it has no matching entry —
  // and would overwrite whatever size the user had chosen on those pages.
  const persistGlobalPageSize = useCallback(
    (size: number) => {
      if (GLOBAL_PAGE_SIZES.has(size)) {
        setPreference({ globalPageSize: size });
      }
    },
    [setPreference]
  );

  const handlePageSize = useCallback(
    (page: number) => {
      setPageSize(page);
      persistGlobalPageSize(page);
      setCurrentPage(INITIAL_PAGING_VALUE);

      // Update URL params, removing cursor data since they're invalid with new page size
      updateUrlParams({
        pageSize: String(page),
        currentPage: String(INITIAL_PAGING_VALUE),
        cursorType: null,
        cursorValue: null,
      });
    },
    [setPageSize, persistGlobalPageSize, setCurrentPage, updateUrlParams]
  );

  const paginationVisible = useMemo(() => {
    const hasCursorPagination = Boolean(paging.before || paging.after);

    return (
      hasCursorPagination ||
      paging.total > pageSize ||
      pageSize !== (defaultPageSize ?? PAGE_SIZE_BASE)
    );
  }, [defaultPageSize, paging.after, paging.before, paging.total, pageSize]);

  const handlePageChange = useCallback(
    (
      page: number | ((page: number) => number),
      cursorData?: CursorState,
      pageSize?: number
    ) => {
      const nextPage = typeof page === 'function' ? page(currentPage) : page;

      setCurrentPage(nextPage);

      const urlUpdate: Partial<PagingUrlParams> = {
        currentPage: String(nextPage),
      };

      if (cursorData) {
        urlUpdate.cursorType = cursorData.cursorType ?? undefined;
        urlUpdate.cursorValue = cursorData.cursorValue;
      }

      if (pageSize) {
        urlUpdate.pageSize = pageSize;
        persistGlobalPageSize(pageSize);
      }

      updateUrlParams(urlUpdate as FilterState);
    },
    [currentPage, setCurrentPage, persistGlobalPageSize, updateUrlParams]
  );

  return {
    paging,
    handlePagingChange: setPaging,
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange: handlePageSize,
    showPagination: paginationVisible,
    pagingCursor: pagingCursorUrlParams,
  };
};
