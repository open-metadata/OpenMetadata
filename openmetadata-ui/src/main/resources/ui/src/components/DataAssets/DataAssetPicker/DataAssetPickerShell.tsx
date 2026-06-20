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
import {
  Badge,
  Box,
  Divider,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Check,
  CornerDownLeft,
  SearchLg,
  SlashDivider,
} from '@untitledui/icons';
import classNames from 'classnames';
import { FC, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataAssetPickerOption,
  DataAssetPickerShellProps,
} from './DataAssetPicker.interface';
import DataAssetPickerRow from './DataAssetPickerRow';

const DataAssetPickerShell: FC<DataAssetPickerShellProps> = ({
  renderTrigger,
  options,
  selectionMode,
  selectedIds,
  onToggle,
  onOpenChange,
  searchable = true,
  searchText = '',
  onSearchChange,
  showCountBar = true,
  totalCount,
  isLoading = false,
  onScroll,
  showFooterHints = true,
  allowAllOption = false,
  onSelectAll,
  popoverClassName,
  popoverAlign = 'left',
  popoverPlacement = 'bottom',
  placeholder,
}) => {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown, true);
    }

    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  const resolvedTotal = totalCount ?? options.length;

  const handleRowSelect = (option: DataAssetPickerOption) => {
    onToggle(option);
    if (selectionMode === 'single') {
      close();
    }
  };

  const handleSelectAll = () => {
    onSelectAll?.();
    if (selectionMode === 'single') {
      close();
    }
  };

  return (
    <div className="tw:relative" ref={wrapperRef}>
      {renderTrigger({ isOpen, open, close })}

      {isOpen && (
        <Box
          className={classNames(
            'tw:absolute tw:z-50 tw:w-95 tw:rounded-lg tw:bg-primary tw:shadow-lg tw:ring-1 tw:ring-secondary_alt tw:overflow-hidden',
            popoverAlign === 'right' ? 'tw:right-0' : 'tw:left-0',
            popoverPlacement === 'top'
              ? 'tw:bottom-full tw:mb-1'
              : 'tw:top-full tw:mt-1',
            popoverClassName
          )}
          direction="col">
          {searchable && (
            <Box>
              <Input
                autoFocus
                className="tw:w-full"
                icon={SearchLg}
                iconClassName="tw:size-3.5"
                inputClassName="tw:text-xs tw:placeholder:text-xs"
                placeholder={
                  placeholder ??
                  t('label.search-entity', { entity: t('label.asset-plural') })
                }
                value={searchText}
                wrapperClassName="tw:rounded-none tw:bg-transparent tw:shadow-none tw:ring-0"
                onChange={(value) => onSearchChange?.(value)}
              />
            </Box>
          )}

          {showCountBar && (
            <Box className="tw:px-3.5 tw:py-1.5 tw:bg-secondary tw:border-b tw:border-t tw:border-secondary">
              <Typography className="tw:text-tertiary" size="text-xs">
                {t('label.showing-count-of-total-assets', {
                  count: options.length,
                  total: resolvedTotal,
                })}
              </Typography>
            </Box>
          )}

          <Box
            className="tw:overflow-y-auto tw:flex-1 tw:p-1 tw:max-h-80"
            direction="col"
            onScroll={onScroll}>
            {isLoading && (
              <Box align="center" className="tw:py-4" justify="center">
                <Typography className="tw:text-quaternary" size="text-sm">
                  {t('label.loading')}
                </Typography>
              </Box>
            )}
            {allowAllOption && (
              <>
                <button
                  className={classNames(
                    'tw:w-full tw:flex tw:items-center tw:gap-2 tw:px-2.5 tw:py-2 tw:rounded-md tw:mb-1 tw:justify-between',
                    'tw:cursor-pointer tw:text-left tw:transition tw:duration-100',
                    'tw:hover:bg-utility-gray-blue-50 tw:outline-hidden'
                  )}
                  type="button"
                  onClick={handleSelectAll}>
                  <Box align="center" className="tw:min-w-0 tw:flex-1" gap={2}>
                    <span className="tw:flex tw:items-center tw:justify-center tw:h-7 tw:w-7 tw:rounded-md tw:shrink-0 tw:opacity-90 tw:bg-utility-gray-blue-50">
                      <SlashDivider
                        className="tw:text-utility-gray-500"
                        size={14}
                      />
                    </span>

                    <Box
                      className="tw:min-w-0 tw:flex-1 tw:[&_.prose]:leading-tight"
                      direction="col">
                      <Typography
                        ellipsis
                        className="tw:truncate tw:leading-tight"
                        size="text-xs"
                        weight="medium">
                        {t('label.all-entity', {
                          entity: t('label.asset-plural'),
                        })}
                      </Typography>

                      <Typography
                        ellipsis
                        className="tw:text-tertiary tw:truncate tw:leading-tight"
                        size="text-xs">
                        {t('label.clear-entity-filter', {
                          entity: t('label.asset'),
                        })}
                      </Typography>
                    </Box>
                  </Box>

                  {selectedIds.size === 0 && (
                    <Check
                      className="tw:shrink-0"
                      size={16}
                      strokeWidth={1.5}
                    />
                  )}
                </button>
                <Divider className="tw:my-1" />
              </>
            )}

            {!isLoading && options.length === 0 && (
              <Box align="center" className="tw:py-4" justify="center">
                <Typography className="tw:text-quaternary" size="text-xs">
                  {t('label.no-data-found')}
                </Typography>
              </Box>
            )}

            {!isLoading &&
              options.map((option) => (
                <DataAssetPickerRow
                  isSelected={selectedIds.has(option.id)}
                  key={option.id}
                  option={option}
                  onSelect={handleRowSelect}
                />
              ))}
          </Box>

          {showFooterHints && (
            <Box
              align="center"
              className="tw:px-3 tw:py-2 tw:border-t tw:border-secondary tw:bg-secondary tw:shrink-0"
              gap={2}>
              <Box align="center" gap={1}>
                <Badge size="xs" type="color">
                  <CornerDownLeft className="tw:text-tertiary" size={12} />
                </Badge>
                <Typography className="tw:text-tertiary" size="text-xs">
                  {t('label.select-lowercase')}
                </Typography>
              </Box>
              <Typography className="tw:text-tertiary" size="text-xs">
                ·
              </Typography>
              <Box align="center" gap={1}>
                <Badge size="xs" type="color">
                  {t('label.esc')}
                </Badge>
                <Typography className="tw:text-tertiary" size="text-xs">
                  {t('label.close-lowercase')}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </div>
  );
};

export default DataAssetPickerShell;
