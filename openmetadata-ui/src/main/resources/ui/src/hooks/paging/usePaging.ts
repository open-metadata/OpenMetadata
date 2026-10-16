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
  LIST_PAGE_SIZE_OPTIONS,
  pagingObject,
} from '../../constants/constants';
import { CursorType } from '../../enums/pagination.enum';
import { Paging } from '../../generated/type/paging';
import { useTableFilters } from '../useTableFilters';
import { useSavedPageSize } from './useSavedPageSize';

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
 * @param defaultPageSize where to start when the URL carries no size; falls back to the size the
 *   user last picked on this page's scale (`useSavedPageSize`).
 * @param pageSizeOptions the sizes this page's picker offers; defaults to the app-wide list scale.
 *   A size from the shared URL param or preference is reconciled to this set, so a grid's 48 left
 *   in the URL, or an off-scale size an older build stored in the preference, cannot reach a
 *   15/25/50 picker. Pass the grid scale on grid pages.
 *   Pass a stable reference (a module constant) — a fresh array each render re-runs the sync
 *   effect below, which is wasted work rather than a bug, since its updates bail on equal values.
 */
export const usePaging = (
  defaultPageSize?: number,
  pageSizeOptions: number[] = LIST_PAGE_SIZE_OPTIONS
): UsePagingInterface => {
  const { savedPageSize, savePageSize } = useSavedPageSize(pageSizeOptions);

  const fallbackPageSize = defaultPageSize ?? savedPageSize;
  const processedPageSize = !pageSizeOptions.includes(fallbackPageSize)
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
  const resolvedPageSize = !pageSizeOptions.includes(urlPageSize)
    ? processedPageSize
    : urlPageSize;

  const initialCurrentPage =
    Number(urlParams.currentPage) || INITIAL_PAGING_VALUE;

  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [currentPage, setCurrentPage] = useState<number>(initialCurrentPage);
  const [storedPageSize, setStoredPageSize] =
    useState<number>(resolvedPageSize);
  // The sync effect below corrects the stored size a render late. When the options change (a page
  // switching between its list and grid scale), callers would fetch with the old scale's size in
  // that render, so hand out the resolved size until the stored one catches up.
  const pageSize = pageSizeOptions.includes(storedPageSize)
    ? storedPageSize
    : resolvedPageSize;

  // Keep pagination in sync when filters or other controls update paging params directly in the URL.
  useEffect(() => {
    const nextCurrentPage =
      Number(urlParams.currentPage) || INITIAL_PAGING_VALUE;

    setCurrentPage((currentPage) =>
      currentPage === nextCurrentPage ? currentPage : nextCurrentPage
    );
    setStoredPageSize((pageSize) =>
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

  const handlePageSize = useCallback(
    (page: number) => {
      setStoredPageSize(page);
      savePageSize(page);
      setCurrentPage(INITIAL_PAGING_VALUE);

      // Update URL params, removing cursor data since they're invalid with new page size
      updateUrlParams({
        pageSize: String(page),
        currentPage: String(INITIAL_PAGING_VALUE),
        cursorType: null,
        cursorValue: null,
      });
    },
    [setStoredPageSize, savePageSize, setCurrentPage, updateUrlParams]
  );

  const paginationVisible = useMemo(() => {
    const hasCursorPagination = Boolean(paging.before || paging.after);
    const isNonDefaultSize =
      pageSize !== (defaultPageSize ?? pageSizeOptions[0]);

    return (
      hasCursorPagination ||
      paging.total > pageSize ||
      (paging.total > 0 && isNonDefaultSize)
    );
  }, [
    defaultPageSize,
    pageSizeOptions,
    paging.after,
    paging.before,
    paging.total,
    pageSize,
  ]);

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
        savePageSize(pageSize);
      }

      updateUrlParams(urlUpdate as FilterState);
    },
    [currentPage, setCurrentPage, savePageSize, updateUrlParams]
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
