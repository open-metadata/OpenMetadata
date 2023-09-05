/*
 *  Copyright 2022 Collate.
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
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CursorType } from '../../../enums/pagination.enum';
import { NextPreviousProps, PagingProps } from './NextPrevious.interface';

const computeTotalPages = (pSize: number, total: number) => {
  return Math.ceil(total / pSize);
};

const NextPrevious: FC<NextPreviousProps> = ({
  paging,
  pagingHandler,
  pageSize,
  isNumberBased = false,
  currentPage = 1,
  ...pagingProps
}: NextPreviousProps) => {
  const { t } = useTranslation();
  const {
    pageSizeOptions = [10, 25, 50],
    onShowSizeChange,
    showPageSize,
  } = (pagingProps ?? {}) as PagingProps;

  const onNextHandler = () => {
    if (isNumberBased) {
      pagingHandler(currentPage + 1);
    } else {
      pagingHandler(CursorType.AFTER, currentPage + 1);
    }
  };

  const onPreviousHandler = () => {
    if (isNumberBased) {
      pagingHandler(currentPage - 1);
    } else {
      pagingHandler(CursorType.BEFORE, currentPage - 1);
    }
  };

  const computePrevDisableState = () => {
    if (isNumberBased) {
      return currentPage === 1;
    } else {
      return paging.before ? false : true;
    }
  };

  const computeNextDisableState = () => {
    if (isNumberBased) {
      const totalPages = computeTotalPages(pageSize, paging.total);

      return currentPage === totalPages;
    } else {
      return paging.after ? false : true;
    }
  };

  return (
    <div className="flex-center gap-3" data-testid="pagination">
      <Button
        ghost
        className="hover-button text-sm flex-center"
        data-testid="previous"
        disabled={computePrevDisableState()}
        icon={<ArrowLeftOutlined />}
        type="primary"
        onClick={onPreviousHandler}>
        <span>{t('label.previous')}</span>
      </Button>
      <span data-testid="page-indicator">{`${currentPage}/${computeTotalPages(
        pageSize,
        paging.total
      )} Page`}</span>
      <Button
        ghost
        className="hover-button text-sm flex-center"
        data-testid="next"
        disabled={computeNextDisableState()}
        type="primary"
        onClick={onNextHandler}>
        <span> {t('label.next')}</span>
        <ArrowRightOutlined />
      </Button>
      {showPageSize && (
        <Dropdown
          menu={{
            items: pageSizeOptions.map((size) => ({
              label: `${size} / Page`,
              value: size,
              key: size,
              onClick: () => onShowSizeChange && onShowSizeChange(size),
            })),
          }}>
          <Button onClick={(e) => e.preventDefault()}>
            {`${pageSize} / Page`}
            <DownOutlined />
          </Button>
        </Dropdown>
      )}
    </div>
  );
};

export default NextPrevious;
