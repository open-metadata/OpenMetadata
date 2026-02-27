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

import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { ArrowLeft, ArrowRight } from '@untitledui/icons';
import classNames from 'classnames';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PAGE_SIZE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../constants/constants';
import { formatNumberWithComma } from '../../../../utils/CommonUtils';

// Default rows per page options used across pagination components
const DEFAULT_ROWS_PER_PAGE_OPTIONS = [
  PAGE_SIZE,
  PAGE_SIZE_MEDIUM,
  PAGE_SIZE_LARGE,
] as const;

interface PaginationControlsConfig {
  currentPage: number;
  totalPages: number;
  totalEntities: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  rowsPerPageOptions?: number[];
  loading?: boolean;
  prevNextOnly?: boolean;
  hideIndexPagination?: boolean;
}

export const usePaginationControls = (config: PaginationControlsConfig) => {
  const { t } = useTranslation();
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);

  const goToFirstPage = () => config.onPageChange(1);
  const goToLastPage = () => config.onPageChange(config.totalPages);
  const goToNextPage = () =>
    config.onPageChange(Math.min(config.currentPage + 1, config.totalPages));
  const goToPreviousPage = () =>
    config.onPageChange(Math.max(config.currentPage - 1, 1));

  const showPagination = config.totalPages > 1;

  const rowsPerPageOptions = useMemo(
    () => config.rowsPerPageOptions ?? [...DEFAULT_ROWS_PER_PAGE_OPTIONS],
    [config.rowsPerPageOptions]
  );

  // Ensure the selected value is in the options, otherwise use the first option
  const selectedPageSize = useMemo(() => {
    return rowsPerPageOptions.includes(config.pageSize)
      ? config.pageSize
      : rowsPerPageOptions[0];
  }, [rowsPerPageOptions, config.pageSize]);

  const displayedRowsRange = useMemo(() => {
    const start = (config.currentPage - 1) * config.pageSize + 1;
    const end = Math.min(
      config.currentPage * config.pageSize,
      config.totalEntities
    );

    return { start, end };
  }, [config.currentPage, config.pageSize, config.totalEntities]);

  const paginationItems = useMemo(() => {
    const items: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];
    const total = config.totalPages;
    const current = config.currentPage;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        items.push(i);
      }
    } else {
      items.push(1);
      if (current > 3) {
        items.push('ellipsis-start');
      }
      const rangeStart = Math.max(2, current - 1);
      const rangeEnd = Math.min(total - 1, current + 1);
      for (let i = rangeStart; i <= rangeEnd; i++) {
        items.push(i);
      }
      if (current < total - 2) {
        items.push('ellipsis-end');
      }
      items.push(total);
    }

    return items;
  }, [config.currentPage, config.totalPages]);

  const paginationControls = useMemo(
    () => (
      <div
        className="tw:flex tw:items-center tw:justify-between tw:border-t tw:border-border-secondary tw:py-4 tw:px-5"
        data-testid="pagination">
        <Button
          color="secondary"
          data-testid="previous"
          iconLeading={<ArrowLeft className="tw:size-4" />}
          isDisabled={config.currentPage === 1}
          size="sm"
          onClick={() => config.onPageChange(config.currentPage - 1)}>
          {t('label.previous')}
        </Button>

        {!config.prevNextOnly && !config.hideIndexPagination && (
          <div className="tw:flex tw:items-center tw:gap-1">
            {paginationItems.map((item) => {
              if (item === 'ellipsis-start' || item === 'ellipsis-end') {
                return (
                  <span
                    className="tw:px-2 tw:text-sm tw:text-secondary"
                    key={item}>
                    ...
                  </span>
                );
              }

              const isCurrentPage = item === config.currentPage;
              const pageButtonClassName = classNames(
                'tw:flex tw:size-9 tw:cursor-pointer tw:items-center tw:justify-center',
                'tw:rounded-md tw:border tw:text-sm tw:font-medium tw:outline-hidden',
                'tw:transition tw:duration-100 tw:ease-linear',
                {
                  'tw:border-border-secondary tw:bg-brand-solid tw:text-white':
                    isCurrentPage,
                  'tw:border-transparent tw:text-secondary tw:hover:bg-primary_hover tw:hover:text-secondary_hover':
                    !isCurrentPage,
                }
              );

              return (
                <button
                  className={pageButtonClassName}
                  key={item}
                  onClick={() => config.onPageChange(item)}>
                  {item}
                </button>
              );
            })}
          </div>
        )}

        <div className="tw:flex tw:items-center tw:gap-3">
          {!config.prevNextOnly && config.onPageSizeChange && (
            <div className="tw:flex tw:items-center tw:gap-2">
              <p className="tw:m-0 tw:whitespace-nowrap tw:text-sm tw:text-secondary">
                {`${formatNumberWithComma(
                  displayedRowsRange.start
                )}-${formatNumberWithComma(displayedRowsRange.end)} ${t(
                  'label.of'
                )} ${formatNumberWithComma(config.totalEntities)}`}
              </p>
              <Dropdown.Root
                isOpen={isPageSizeOpen}
                onOpenChange={setIsPageSizeOpen}>
                <Button
                  color="secondary"
                  data-testid="rows-per-page-select"
                  size="sm">
                  {selectedPageSize}
                </Button>
                <Dropdown.Popover className="tw:w-max">
                  <div className="tw:py-1">
                    {rowsPerPageOptions.map((option) => {
                      const isSelected = selectedPageSize === option;
                      const optionClassName = classNames(
                        'tw:block tw:w-full tw:cursor-pointer tw:px-4 tw:py-2',
                        'tw:text-left tw:text-sm tw:font-normal tw:outline-hidden',
                        'tw:transition tw:duration-100 tw:ease-linear',
                        {
                          'tw:bg-brand-solid tw:font-semibold tw:text-white tw:hover:bg-brand-solid_hover':
                            isSelected,
                          'tw:text-secondary tw:hover:bg-primary_hover tw:hover:text-secondary_hover':
                            !isSelected,
                        }
                      );

                      return (
                        <button
                          className={optionClassName}
                          data-testid={`option-${option}`}
                          key={option}
                          onClick={() => {
                            config.onPageSizeChange?.(option);
                            setIsPageSizeOpen(false);
                          }}>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </Dropdown.Popover>
              </Dropdown.Root>
            </div>
          )}

          <Button
            color="secondary"
            data-testid="next"
            iconTrailing={<ArrowRight className="tw:size-4" />}
            isDisabled={config.currentPage >= config.totalPages}
            size="sm"
            onClick={() => config.onPageChange(config.currentPage + 1)}>
            {t('label.next')}
          </Button>
        </div>
      </div>
    ),
    [
      config.currentPage,
      config.totalPages,
      config.pageSize,
      config.totalEntities,
      config.onPageChange,
      config.onPageSizeChange,
      config.prevNextOnly,
      config.hideIndexPagination,
      rowsPerPageOptions,
      displayedRowsRange,
      selectedPageSize,
      paginationItems,
      isPageSizeOpen,
      t,
    ]
  );

  return {
    paginationControls,
    currentPage: config.currentPage,
    totalPages: config.totalPages,
    showPagination,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
  };
};
