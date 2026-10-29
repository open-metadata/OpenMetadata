/*
 *  Copyright 2024 Collate.
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

import { Button, Dropdown, Typography } from '@openmetadata/ui-core-components';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
} from '@openmetadata/ui-core-components/icons';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { computeTotalPages } from '../../../utils/PaginationUtils';
import {
  NextPreviousWithOffsetProps,
  PagingProps,
} from './NextPreviousWithOffset.interface';

const NextPreviousWithOffset = ({
  paging,
  pagingHandler,
  pageSize,
  currentPage = 1,
  isLoading,
  ...pagingProps
}: NextPreviousWithOffsetProps) => {
  const { t } = useTranslation();
  const {
    pageSizeOptions = [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE],
    onShowSizeChange,
  } = (pagingProps ?? {}) as PagingProps;

  const onNextHandler = useCallback(() => {
    pagingHandler({
      offset: currentPage * pageSize,
      page: currentPage + 1,
    });
  }, [pagingHandler, currentPage, pageSize]);

  const onPreviousHandler = useCallback(() => {
    pagingHandler({
      offset: (currentPage - 2) * pageSize,
      page: currentPage - 1,
    });
  }, [pagingHandler, currentPage, pageSize]);

  const totalPages = useMemo(
    () => computeTotalPages(pageSize, paging.total),
    [pageSize, paging.total]
  );

  const nextButtonDisabled = useMemo(() => {
    return currentPage >= totalPages;
  }, [currentPage, totalPages]);

  return (
    <div className="flex-center gap-3" data-testid="pagination">
      <Button
        color="secondary-brand"
        data-testid="previous"
        iconLeading={ArrowLeft}
        isDisabled={currentPage === 1 || isLoading}
        onClick={onPreviousHandler}>
        <Typography>{t('label.previous')}</Typography>
      </Button>
      <Typography data-testid="page-indicator">{`${currentPage}/${totalPages} ${t(
        'label.page'
      )}`}</Typography>
      <Button
        color="secondary-brand"
        data-testid="next"
        isDisabled={nextButtonDisabled || isLoading}
        onClick={onNextHandler}>
        <Typography> {t('label.next')}</Typography>
        <ArrowRight className="tw:shrink-0 tw:ml-2" size={14} />
      </Button>
      {onShowSizeChange && (
        <Dropdown.Root>
          <Button
            color="secondary"
            data-testid="page-size-change-button"
            iconTrailing={<ChevronDown className="tw:shrink-0" size={14} />}
            isDisabled={isLoading}>
            {`${pageSize} / ${t('label.page')}`}
          </Button>
          <Dropdown.Popover className="tw:w-auto">
            <Dropdown.Menu
              aria-label={t('label.size')}
              selectionMode="none"
              onAction={(key) => onShowSizeChange(Number(key))}>
              {pageSizeOptions.map((size) => (
                <Dropdown.Item id={String(size)} key={size}>
                  {`${size} / ${t('label.page')}`}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      )}
    </div>
  );
};

export default NextPreviousWithOffset;
