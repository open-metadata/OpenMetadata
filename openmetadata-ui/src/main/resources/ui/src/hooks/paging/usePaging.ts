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
  useMemo,
  useState,
} from 'react';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  pagingObject,
} from '../../constants/constants';
import { CursorType } from '../../enums/pagination.enum';
import { Paging } from '../../generated/type/paging';
import {
  useCurrentUserPreferences,
  UserPreferences,
} from '../currentUserStore/useCurrentUserStore';
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
  pageSizeOptions: number[];
  handlePageSizeChange: (page: number) => void;
  showPagination: boolean;
  pagingCursor: PagingUrlParams;
}

export const usePaging = (
  defaultPageSize?: number,
  storageKey: keyof UserPreferences = 'globalPageSize',
  maxPageSize = 50
): UsePagingInterface => {
  const { preferences, setPreference } = useCurrentUserPreferences();

  const { pageSizeOptions: systemPageSizeOptions } = useMemo(() => {
    const defaultSize = defaultPageSize || PAGE_SIZE_BASE;

    // Generate options based on maxPageSize
    const baseOptions = [15, 25, 50];
    if (maxPageSize >= 250) {
      baseOptions.push(250);
    }
    if (maxPageSize >= 500) {
      baseOptions.push(500);
    }

    // Filter to only include options up to maxPageSize
    const options = baseOptions.filter((opt) => opt <= maxPageSize);

    // Ensure defaultSize is in options if it's within maxPageSize
    if (!options.includes(defaultSize) && defaultSize <= maxPageSize) {
      options.push(defaultSize);
      options.sort((a, b) => a - b);
    }

    return {
      pageSizeOptions: options,
      defaultSize,
    };
  }, [defaultPageSize, maxPageSize]);

  const processedPageSize =
    (preferences[storageKey] as number) ?? defaultPageSize ?? PAGE_SIZE_BASE;

  const { filters: urlParams, setFilters: updateUrlParams } = useTableFilters({
    cursorType: undefined,
    cursorValue: undefined,
    currentPage: String(INITIAL_PAGING_VALUE),
    pageSize: String(processedPageSize),
  });

  const initialPageSize = Number(urlParams.pageSize) || processedPageSize;
  const initialCurrentPage =
    Number(urlParams.currentPage) || INITIAL_PAGING_VALUE;

  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [currentPage, setCurrentPage] = useState<number>(initialCurrentPage);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);

  const pagingCursorUrlParams: PagingUrlParams = useMemo(
    () => ({
      cursorType: urlParams.cursorType,
      cursorValue: urlParams.cursorValue,
      currentPage: urlParams.currentPage,
      pageSize: Number(urlParams.pageSize) || processedPageSize,
    }),
    [
      urlParams.cursorType,
      urlParams.cursorValue,
      urlParams.currentPage,
      urlParams.pageSize,
      processedPageSize,
    ]
  );

  const handlePageSize = useCallback(
    (page: number) => {
      setPageSize(page);
      setPreference({ [storageKey]: page } as Partial<UserPreferences>);
      setCurrentPage(INITIAL_PAGING_VALUE);

      // Update URL params, removing cursor data since they're invalid with new page size
      updateUrlParams({
        pageSize: String(page),
        currentPage: String(INITIAL_PAGING_VALUE),
        cursorType: null,
        cursorValue: null,
      });
    },
    [setPageSize, setCurrentPage, updateUrlParams, storageKey, setPreference]
  );

  const paginationVisible = useMemo(() => {
    return (
      paging.total > pageSize ||
      pageSize !== (defaultPageSize ?? PAGE_SIZE_BASE)
    );
  }, [processedPageSize, paging, pageSize]);

  const handlePageChange = useCallback(
    (
      page: number | ((page: number) => number),
      cursorData?: CursorState,
      pageSize?: number
    ) => {
      setCurrentPage(page);

      const urlUpdate: Partial<PagingUrlParams> = {
        currentPage: String(page),
      };

      if (cursorData) {
        urlUpdate.cursorType = cursorData.cursorType ?? undefined;
        urlUpdate.cursorValue = cursorData.cursorValue;
      }

      if (pageSize) {
        urlUpdate.pageSize = pageSize;
        setPreference({ [storageKey]: pageSize } as Partial<UserPreferences>);
      }

      updateUrlParams(urlUpdate as FilterState);
    },
    [setCurrentPage, updateUrlParams, currentPage, storageKey, setPreference]
  );

  return {
    paging,
    handlePagingChange: setPaging,
    currentPage,
    handlePageChange,
    pageSize,
    pageSizeOptions: systemPageSizeOptions,
    handlePageSizeChange: handlePageSize,
    showPagination: paginationVisible,
    pagingCursor: pagingCursorUrlParams,
  };
};
