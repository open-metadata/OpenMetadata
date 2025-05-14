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
import qs from 'qs';
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  pagingObject,
} from '../../constants/constants';
import { CursorType } from '../../enums/pagination.enum';
import { Paging } from '../../generated/type/paging';
import useCustomLocation from '../useCustomLocation/useCustomLocation';

interface CursorState {
  cursorType: CursorType | null;
  cursorValue?: string;
}

interface PagingHistoryStateData {
  cursorData: CursorState;
  currentPage: number | null;
  pageSize: number | null;
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
  pagingCursor: PagingHistoryStateData;
}
export const usePaging = (
  defaultPageSize = PAGE_SIZE_BASE
): UsePagingInterface => {
  // Extract initial values from history state if present
  const navigate = useNavigate();
  const location = useCustomLocation();
  const historyState = location.state as any;
  const initialPageSize = historyState?.pageSize ?? defaultPageSize;
  const initialCurrentPage = historyState?.cursorData?.cursorType
    ? historyState.currentPage
    : INITIAL_PAGING_VALUE;

  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [currentPage, setCurrentPage] = useState<number>(initialCurrentPage);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);

  const pagingCursorHistoryState: PagingHistoryStateData = {
    cursorData: historyState?.cursorData,
    currentPage: historyState?.currentPage,
    pageSize: historyState?.pageSize,
  };

  const handlePageSize = useCallback(
    (page: number) => {
      setPageSize(page);
      setCurrentPage(INITIAL_PAGING_VALUE);
      const searchParams = qs.stringify(
        qs.parse(location.search, { ignoreQueryPrefix: true }),
        { addQueryPrefix: true }
      );
      // Update location state to persist pageSize for navigation
      navigate(
        {
          search: searchParams,
        },
        {
          state: {
            pageSize: page,
          },
        }
      );
    },
    [setPageSize, setCurrentPage, history, location]
  );
  const paginationVisible = useMemo(() => {
    return paging.total > pageSize || pageSize !== defaultPageSize;
  }, [defaultPageSize, paging, pageSize]);

  const handlePageChange = useCallback(
    (
      page: number | ((page: number) => number),
      cursorData?: CursorState,
      pageSize?: number
    ) => {
      const searchParams = qs.stringify(
        qs.parse(location.search, { ignoreQueryPrefix: true }),
        { addQueryPrefix: true }
      );
      setCurrentPage(page);
      if (cursorData) {
        navigate(
          {
            search: searchParams,
          },
          {
            state: {
              cursorData,
              currentPage: page,
              pageSize,
            },
          }
        );
      }
    },
    [setCurrentPage, history, location]
  );

  return {
    paging,
    handlePagingChange: setPaging,
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange: handlePageSize,
    showPagination: paginationVisible,
    pagingCursor: pagingCursorHistoryState,
  };
};
