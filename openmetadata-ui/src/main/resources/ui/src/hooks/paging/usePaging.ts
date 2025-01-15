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
import { useHistory } from 'react-router-dom';
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
  cursorValue: string | null;
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
    pageSize?: number | null
  ) => void;
  pageSize: number;
  handlePageSizeChange: (page: number) => void;
  showPagination: boolean;
  pagingCursor: PagingHistoryStateData;
}
export const usePaging = (
  defaultPageSize = PAGE_SIZE_BASE
): UsePagingInterface => {
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const history = useHistory();
  const location = useCustomLocation();
  const historyState = location.state as any;
  const pagingCursorHistoryState: PagingHistoryStateData = {
    cursorData: historyState?.cursorData,
    currentPage: historyState?.currentPage,
    pageSize: historyState?.pageSize,
  };

  const handlePageSize = useCallback(
    (page: number) => {
      setPageSize(page);
      setCurrentPage(INITIAL_PAGING_VALUE);

      // Update location state to persist pageSize for navigation
      history.replace({
        ...location,
        state: {
          pageSize: page,
        },
      });
    },
    [setPageSize, setCurrentPage, location, history]
  );
  const paginationVisible = useMemo(() => {
    return paging.total > pageSize || pageSize !== defaultPageSize;
  }, [defaultPageSize, paging, pageSize]);

  const handlePageChange = useCallback(
    (
      page: number | ((page: number) => number),
      cursorData?: CursorState,
      pageSize?: number | null
    ) => {
      setCurrentPage(page);
      if (cursorData) {
        history.replace({
          ...location,
          state: {
            ...((location.state as any) || {}),
            cursorData,
            currentPage: page,
            pageSize,
          },
        });
      }
    },
    [setCurrentPage, history, location]
  );

  // set pagesize and current page on page reload from history state if present
  useEffect(() => {
    const pageSizeToUse = historyState?.pageSize ?? pageSize;
    const cursorData = historyState?.cursorData?.cursorType
      ? historyState.cursorData
      : { cursorType: null, cursorValue: null };
    const pageToUse = historyState?.cursorData?.cursorType
      ? historyState.currentPage
      : currentPage;

    handlePageSize(pageSizeToUse);
    handlePageChange(pageToUse, cursorData, pageSizeToUse);
  }, []);

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
