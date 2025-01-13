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

interface PagingStateData {
  cursorData: CursorState;
  currentPage: number | null;
  pageSize: number | null;
}

interface LocationState {
  [path: string]: PagingStateData;
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
  handlePageSizeChange: (page: number, resetHistoryState?: boolean) => void;
  showPagination: boolean;
  pagingCursor: () => PagingStateData;
}
export const usePaging = (
  defaultPageSize = PAGE_SIZE_BASE
): UsePagingInterface => {
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const history = useHistory();
  const location = useCustomLocation();

  const handlePageSize = useCallback(
    (page: number, resetHistoryState = true) => {
      setPageSize(page);
      setCurrentPage(INITIAL_PAGING_VALUE);

      // Update location state to persist pageSize for navigation
      const path = location.pathname;
      const state = (location.state as LocationState) || {};
      const cursorState = state[path] || {};
      history.replace({
        ...location,
        state: {
          ...state,
          [path]: {
            pageSize: page,
            cursorData: resetHistoryState
              ? { cursorType: null, cursorValue: null }
              : cursorState.cursorData,
            currentPage: resetHistoryState
              ? INITIAL_PAGING_VALUE
              : cursorState.currentPage,
          },
        },
      });
    },
    [setPageSize, setCurrentPage, location, history]
  );
  const paginationVisible = useMemo(() => {
    return paging.total > pageSize || pageSize !== defaultPageSize;
  }, [defaultPageSize, paging, pageSize]);

  // Fetch stored cursor values on page reload
  const pagingCursor = useCallback(() => {
    const path = location.pathname;
    const state = (location.state as LocationState) || {};
    const cursorState = state[path];

    return {
      cursorData: {
        cursorType: cursorState?.cursorData.cursorType || null,
        cursorValue: cursorState?.cursorData.cursorValue || null,
      },
      currentPage: cursorState?.currentPage || null,
      pageSize: cursorState?.pageSize || null,
    };
  }, [location]);

  const handlePageChange = (
    page: number | ((page: number) => number),
    cursorData?: CursorState,
    pageSize?: number | null
  ) => {
    setCurrentPage(page);
    if (cursorData) {
      const path = location.pathname;
      history.replace({
        ...location,
        state: {
          ...((location.state as any) || {}),
          [path]: {
            cursorData,
            currentPage: page,
            pageSize,
          },
        },
      });
    }
  };

  return {
    paging,
    handlePagingChange: setPaging,
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange: handlePageSize,
    showPagination: paginationVisible,
    pagingCursor,
  };
};
