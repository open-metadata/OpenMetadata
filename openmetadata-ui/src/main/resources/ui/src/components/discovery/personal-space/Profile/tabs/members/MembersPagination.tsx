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

import { Box, Button, Select } from '@openmetadata/ui-core-components';
import { ArrowLeft, ArrowRight } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PAGE_SIZE_BASE,
    PAGE_SIZE_LARGE,
    PAGE_SIZE_MEDIUM
} from '../../../../../../constants/constants';
import { CursorType } from '../../../../../../enums/pagination.enum';
import { Paging } from '../../../../../../generated/type/paging';
import { computeTotalPages } from '../../../../../../utils/PaginationUtils';

interface MembersPaginationProps {
  currentPage: number;
  paging: Paging;
  pageSize: number;
  isLoading?: boolean;
  isNumberBased?: boolean;
  pageSizeOptions?: number[];
  pagingHandler: (data: {
    currentPage: number;
    cursorType?: CursorType;
  }) => void;
  onShowSizeChange?: (size: number) => void;
}

/**
 * Core-UI (react-aria) replacement for the legacy Ant `NextPrevious`, scoped to
 * the personal-space Members panels. Keeps the cursor (before/after) semantics
 * their server-paged lists rely on.
 */
const MembersPagination: FC<MembersPaginationProps> = ({
  currentPage,
  paging,
  pageSize,
  isLoading,
  isNumberBased = false,
  pageSizeOptions = [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE],
  pagingHandler,
  onShowSizeChange,
}) => {
  const { t } = useTranslation();

  const totalPages = computeTotalPages(pageSize, paging.total);
  const nextCursorPage = currentPage + (paging.after ? 1 : 0);
  const cursorTotalPages = Math.max(totalPages, nextCursorPage, currentPage);
  const displayTotalPages = isNumberBased ? totalPages : cursorTotalPages;

  const isPrevDisabled = isNumberBased
    ? currentPage === 1
    : !paging.before;
  const isNextDisabled = isNumberBased
    ? currentPage === totalPages
    : !paging.after;

  const onNext = () =>
    pagingHandler(
      isNumberBased
        ? { currentPage: currentPage + 1 }
        : { cursorType: CursorType.AFTER, currentPage: currentPage + 1 }
    );

  const onPrev = () =>
    pagingHandler(
      isNumberBased
        ? { currentPage: currentPage - 1 }
        : { cursorType: CursorType.BEFORE, currentPage: currentPage - 1 }
    );

  return (
    <Box
      align="center"
      className="tw:border-t tw:border-secondary tw:py-3"
      data-testid="pagination"
      direction="row"
      gap={3}
      justify="center">
      <Button
        color="secondary"
        data-testid="previous"
        iconLeading={ArrowLeft}
        isDisabled={isPrevDisabled || isLoading}
        size="sm"
        onPress={onPrev}>
        {t('label.previous')}
      </Button>
      <span data-testid="page-indicator">
        {`${t('label.page')} ${currentPage} ${t('label.of')} ${displayTotalPages}`}
      </span>
      <Button
        color="secondary"
        data-testid="next"
        iconTrailing={ArrowRight}
        isDisabled={isNextDisabled || isLoading}
        size="sm"
        onPress={onNext}>
        {t('label.next')}
      </Button>
      {onShowSizeChange && (
        <Select
          data-testid="page-size-selection-dropdown"
          isDisabled={isLoading}
          selectedKey={String(pageSize)}
          size="sm"
          onSelectionChange={(key) => onShowSizeChange(Number(key))}>
          {pageSizeOptions.map((size) => (
            <Select.Item
              id={String(size)}
              key={String(size)}
              textValue={`${size} / ${t('label.page')}`}>
              {`${size} / ${t('label.page')}`}
            </Select.Item>
          ))}
        </Select>
      )}
    </Box>
  );
};

export default MembersPagination;
