/*
 *  Copyright 2025 Collate.
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

import { PaginationCardWithControls } from '@openmetadata/ui-core-components';
import { HTMLAttributes, useState } from 'react';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';

interface PaginationComponentProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  current?: number;
  total?: number;
  pageSize?: number;
  defaultCurrent?: number;
  defaultPageSize?: number;
  hideOnSinglePage?: boolean;
  showSizeChanger?: boolean;
  onChange?: (page: number, pageSize: number) => void;
}

const PaginationComponent = ({
  current,
  total = 0,
  pageSize,
  defaultCurrent = 1,
  defaultPageSize = PAGE_SIZE_BASE,
  hideOnSinglePage = true,
  showSizeChanger,
  onChange,
  ...props
}: PaginationComponentProps) => {
  const [internalPage, setInternalPage] = useState(defaultCurrent);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);
  const currentPage = current ?? internalPage;
  const currentPageSize = pageSize ?? internalPageSize;
  // Ant Design takes a record count; core pagination takes a page count.
  const totalPages = Math.max(1, Math.ceil(total / currentPageSize));

  const changePage = (nextPage: number) => {
    setInternalPage(nextPage);
    onChange?.(nextPage, currentPageSize);
  };

  const changePageSize = (nextSize: number) => {
    // Keep the current page unless a smaller page count makes it unavailable.
    const nextPage = Math.min(
      currentPage,
      Math.max(1, Math.ceil(total / nextSize))
    );
    setInternalPageSize(nextSize);
    setInternalPage(nextPage);
    onChange?.(nextPage, nextSize);
  };

  if (hideOnSinglePage && totalPages <= 1) {
    return null;
  }

  return (
    <PaginationCardWithControls
      {...props}
      page={currentPage}
      pageSize={currentPageSize}
      pageSizeOptions={[PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE]}
      total={totalPages}
      onPageChange={changePage}
      onPageSizeChange={
        showSizeChanger ?? total > 50 ? changePageSize : undefined
      }
    />
  );
};

export default PaginationComponent;
