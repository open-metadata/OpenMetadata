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
  Popover,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Check,
  CornerDownLeft,
  SearchLg,
  SlashDivider,
} from '@untitledui/icons';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { ListBox as AriaListBox, Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { DataAssetPickerShellProps } from './DataAssetPicker.interface';
import DataAssetPickerRow from './DataAssetPickerRow';

// Index -1 = "All Assets" button (only when allowAllOption=true).
// Index 0..n-1 = asset list items.
const ALL_IDX = -1;

const nextFocusIndex = (
  prev: number | null,
  key: 'ArrowDown' | 'ArrowUp',
  hasAll: boolean,
  itemCount: number
): number | null => {
  const hasItems = itemCount > 0;
  const lastIdx = itemCount - 1;
  const firstIdx = hasAll ? ALL_IDX : 0;

  if (!hasAll && !hasItems) {
    return null;
  }

  if (key === 'ArrowDown') {
    if (prev === null) {
      return hasAll ? ALL_IDX : 0;
    }
    if (prev === ALL_IDX) {
      return hasItems ? 0 : ALL_IDX;
    }

    return prev < lastIdx ? prev + 1 : prev;
  }

  // ArrowUp
  if (prev === null || prev === firstIdx) {
    return prev;
  }
  if (prev === 0 && hasAll) {
    return ALL_IDX;
  }

  return prev - 1;
};

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
  allOptionLabel,
  onSelectAll,
  popoverClassName,
  popoverPlacement = 'bottom start',
  placeholder,
}) => {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listBoxRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  // keyboardFocusIndex: -1 = All Assets, 0..n-1 = list items, null = none
  const [keyboardFocusIndex, setKeyboardFocusIndex] = useState<number | null>(
    null
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setKeyboardFocusIndex(null);
  }, []);

  // Reset keyboard focus only when the list is replaced by a new query
  // (search text change or popover reopen), not when pagination appends
  // more rows to the existing list.
  useEffect(() => {
    setKeyboardFocusIndex(null);
  }, [searchText, isOpen]);

  const confirmFocusedItem = useCallback(() => {
    if (keyboardFocusIndex === ALL_IDX) {
      onSelectAll?.();
    } else if (keyboardFocusIndex !== null && keyboardFocusIndex >= 0) {
      const option = options[keyboardFocusIndex];
      if (option) {
        onToggle(option);
      }
    } else {
      return;
    }
    if (selectionMode === 'single') {
      close();
    }
  }, [
    keyboardFocusIndex,
    options,
    onSelectAll,
    onToggle,
    selectionMode,
    close,
  ]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') {
        return;
      }
      e.preventDefault();
      if (e.key === 'Enter') {
        confirmFocusedItem();

        return;
      }
      setKeyboardFocusIndex((prev) =>
        nextFocusIndex(
          prev,
          e.key as 'ArrowDown' | 'ArrowUp',
          allowAllOption,
          options.length
        )
      );
    },
    [confirmFocusedItem, allowAllOption, options.length]
  );

  // Scroll the focused list item into view
  useEffect(() => {
    if (keyboardFocusIndex === null || keyboardFocusIndex === ALL_IDX) {
      return;
    }
    if (!listBoxRef.current) {
      return;
    }
    const items = listBoxRef.current.querySelectorAll('[role="option"]');
    const el = items[keyboardFocusIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [keyboardFocusIndex]);

  const resolvedTotal = totalCount ?? options.length;

  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      if (keys === 'all') {
        return;
      }
      const newKeys = keys as Set<string>;
      const added = [...newKeys].find((k) => !selectedIds.has(k));
      const removed = [...selectedIds].find((k) => !newKeys.has(k));
      const changedId = added ?? removed;
      if (!changedId) {
        return;
      }
      const option = options.find((o) => o.id === changedId);
      if (option) {
        onToggle(option);
      }
      if (selectionMode === 'single') {
        close();
      }
    },
    [options, selectedIds, onToggle, selectionMode, close]
  );

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  return (
    <div className="tw:relative tw:leading-0" ref={wrapperRef}>
      {renderTrigger({ isOpen, open, close })}

      <Popover
        className="tw:w-95 tw:overflow-hidden"
        containerClassName={classNames('tw:flex tw:flex-col', popoverClassName)}
        data-testid="picker-popover"
        isOpen={isOpen}
        placement={popoverPlacement}
        triggerRef={wrapperRef}
        onOpenChange={(open) => !open && close()}>
        <Box
          className="tw:contents"
          direction="col"
          onKeyDown={handleSearchKeyDown}>
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

          <div
            className="tw:overflow-y-auto tw:flex-1 tw:p-1 tw:max-h-80 tw:flex tw:flex-col"
            onScroll={onScroll}>
            {isLoading && (
              <Box align="center" className="tw:py-4" justify="center">
                <Typography className="tw:text-quaternary" size="text-sm">
                  {t('label.loading')}...
                </Typography>
              </Box>
            )}

            {!isLoading && allowAllOption && (
              <>
                <button
                  className={classNames(
                    'tw:w-full tw:flex tw:items-center tw:gap-2 tw:px-2.5 tw:py-2 tw:rounded-md tw:mb-1 tw:justify-between',
                    'tw:cursor-pointer tw:text-left tw:transition tw:duration-100',
                    'tw:hover:bg-utility-gray-blue-50 tw:outline-hidden',
                    {
                      'tw:bg-utility-gray-blue-50':
                        keyboardFocusIndex === ALL_IDX,
                    }
                  )}
                  type="button"
                  onClick={() => {
                    onSelectAll?.();
                    if (selectionMode === 'single') {
                      close();
                    }
                  }}>
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
                        {allOptionLabel ??
                          t('label.all-entity', {
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

            {!isLoading && options.length > 0 && (
              <AriaListBox
                aria-label={t('label.asset-plural')}
                className="tw:outline-hidden tw:flex tw:flex-col"
                escapeKeyBehavior="none"
                ref={listBoxRef}
                selectedKeys={selectedIds}
                selectionMode={selectionMode}
                onSelectionChange={handleSelectionChange}>
                {options.map((option, idx) => (
                  <DataAssetPickerRow
                    isFocused={keyboardFocusIndex === idx}
                    key={option.id}
                    option={option}
                  />
                ))}
              </AriaListBox>
            )}
          </div>

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
      </Popover>
    </div>
  );
};

export default DataAssetPickerShell;
