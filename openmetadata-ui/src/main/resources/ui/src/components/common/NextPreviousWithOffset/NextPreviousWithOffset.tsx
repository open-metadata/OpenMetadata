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

import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
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
    return currentPage === totalPages;
  }, [currentPage, totalPages]);

  return (
    <div className="flex-center gap-3" data-testid="pagination">
      <Button
        ghost
        className="hover-button text-sm flex-center"
        data-testid="previous"
        disabled={currentPage === 1 || isLoading}
        icon={<ArrowLeftOutlined />}
        type="primary"
        onClick={onPreviousHandler}>
        <span>{t('label.previous')}</span>
      </Button>
      <span data-testid="page-indicator">{`${currentPage}/${totalPages} ${t(
        'label.page'
      )}`}</span>
      <Button
        ghost
        className="hover-button text-sm flex-center"
        data-testid="next"
        disabled={nextButtonDisabled || isLoading}
        type="primary"
        onClick={onNextHandler}>
        <span> {t('label.next')}</span>
        <ArrowRightOutlined />
      </Button>
      {onShowSizeChange && (
        <Dropdown
          disabled={isLoading}
          menu={{
            items: pageSizeOptions.map((size) => ({
              label: `${size} / ${t('label.page')}`,
              value: size,
              key: size,
              onClick: () => onShowSizeChange(size),
            })),
          }}>
          <Button
            data-testid="page-size-change-button"
            onClick={(e) => e.preventDefault()}>
            {`${pageSize} / ${t('label.page')}`}
            <DownOutlined />
          </Button>
        </Dropdown>
      )}
    </div>
  );
};

export default NextPreviousWithOffset;
