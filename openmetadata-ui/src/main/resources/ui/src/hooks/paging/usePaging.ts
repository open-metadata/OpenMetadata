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
import { useCallback, useMemo, useState } from 'react';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  pagingObject,
} from '../../constants/constants';
import { Paging } from '../../generated/type/paging';

export const usePaging = (defaultPageSize = PAGE_SIZE_BASE) => {
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const handlePageSize = useCallback(
    (page: number) => {
      setPageSize(page);
      setCurrentPage(INITIAL_PAGING_VALUE);
    },
    [setPageSize, setCurrentPage]
  );

  const paginationVisible = useMemo(() => {
    return paging.total > pageSize || pageSize !== defaultPageSize;
  }, [defaultPageSize, paging, pageSize]);

  return {
    paging,
    handlePagingChange: setPaging,
    currentPage,
    handlePageChange: setCurrentPage,
    pageSize,
    handlePageSizeChange: handlePageSize,
    showPagination: paginationVisible,
  };
};
