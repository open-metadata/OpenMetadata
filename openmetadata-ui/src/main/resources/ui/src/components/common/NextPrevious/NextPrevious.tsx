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

import Icon from '@ant-design/icons';
import { Button as CoreButton } from '@openmetadata/ui-core-components';
import { Button, Dropdown } from 'antd';
import classNames from 'classnames';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowRightOutlined } from '../../../assets/svg/arrow-right.svg';
import { ReactComponent as DownOutlined } from '../../../assets/svg/ic-arrow-down.svg';
import {
  ICON_DIMENSION,
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { CursorType } from '../../../enums/pagination.enum';
import { computeTotalPages } from '../../../utils/PaginationUtils';
import { NextPreviousProps, PagingProps } from './NextPrevious.interface';

// Reproduces the legacy antd text-button metrics (40px tall, 15px inline
// padding, 1px transparent border that antd drops when disabled, 25%-black
// disabled text); dark mode falls back to core's disabled token. The icon
// negative margins keep the arrows on the same pixel row as the antd icons.
const PAGINATION_BUTTON_CLASS = [
  'tw:h-10 tw:gap-2 tw:border tw:border-transparent tw:px-[15px] tw:py-2',
  'tw:font-semibold tw:text-utility-gray-500',
  'tw:hover:bg-black/2 tw:hover:text-utility-gray-500',
  'tw:disabled:border-0 tw:disabled:bg-transparent tw:disabled:text-black/25',
  'tw:dark:disabled:text-fg-disabled',
].join(' ');

const NextPrevious: FC<NextPreviousProps> = ({
  className,
  paging,
  pagingHandler,
  pageSize,
  isNumberBased = false,
  currentPage = 1,
  isLoading,
  ...pagingProps
}: NextPreviousProps) => {
  const { t } = useTranslation();
  const {
    pageSizeOptions = [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE],
    onShowSizeChange,
  } = (pagingProps ?? {}) as PagingProps;
  const totalPages = computeTotalPages(pageSize, paging.total);
  const cursorTotalPages = Math.max(
    totalPages,
    currentPage + (paging.after ? 1 : 0),
    currentPage
  );
  const displayTotalPages = isNumberBased ? totalPages : cursorTotalPages;

  const onNextHandler = () => {
    if (isNumberBased) {
      pagingHandler({ currentPage: currentPage + 1 });
    } else {
      pagingHandler({
        cursorType: CursorType.AFTER,
        currentPage: currentPage + 1,
      });
    }
  };

  const onPreviousHandler = () => {
    if (isNumberBased) {
      pagingHandler({ currentPage: currentPage - 1 });
    } else {
      pagingHandler({
        cursorType: CursorType.BEFORE,
        currentPage: currentPage - 1,
      });
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
      return currentPage === totalPages;
    } else {
      return paging.after ? false : true;
    }
  };

  return (
    <div
      aria-label={t('label.page-plural')}
      className={classNames(
        'pagination-container flex-center gap-3',
        className
      )}
      data-testid="pagination"
      role="navigation">
      <CoreButton
        noTextPadding
        className={PAGINATION_BUTTON_CLASS}
        color="tertiary"
        data-testid="previous"
        iconLeading={
          <ArrowRightOutlined className="tw:-mt-px tw:size-3 tw:shrink-0 tw:rotate-180" />
        }
        isDisabled={computePrevDisableState() || isLoading}
        onPress={onPreviousHandler}>
        {t('label.previous')}
      </CoreButton>
      <span className="pagination-indicator" data-testid="page-indicator">{`${t(
        'label.page'
      )} ${currentPage} ${t('label.of')} ${displayTotalPages} `}</span>
      <CoreButton
        noTextPadding
        className={PAGINATION_BUTTON_CLASS}
        color="tertiary"
        data-testid="next"
        iconTrailing={
          <ArrowRightOutlined className="tw:-mt-0.5 tw:size-3 tw:shrink-0" />
        }
        isDisabled={computeNextDisableState() || isLoading}
        onPress={onNextHandler}>
        {t('label.next')}
      </CoreButton>
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
            className="pagination-button"
            data-testid="page-size-selection-dropdown"
            type="text"
            onClick={(e) => e.preventDefault()}>
            {`${pageSize} / ${t('label.page')}`}
            <Icon component={DownOutlined} style={ICON_DIMENSION} />
          </Button>
        </Dropdown>
      )}
    </div>
  );
};

export default NextPrevious;
