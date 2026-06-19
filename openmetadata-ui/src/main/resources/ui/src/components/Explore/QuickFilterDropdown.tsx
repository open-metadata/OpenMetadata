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
import {
  Button,
  Checkbox,
  Input,
  Popover,
  PopoverTrigger,
} from '@openmetadata/ui-core-components';
import { ChevronDown } from '@untitledui/icons';
import { debounce, isUndefined } from 'lodash';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NULL_OPTION_KEY } from '../../constants/AdvancedSearch.constants';
import { getSelectedOptionLabelString } from '../../utils/AdvancedSearchPureUtils';
import Loader from '../common/Loader/Loader';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import { QuickFilterDropdownProps } from './QuickFilterDropdown.interface';

/**
 * Untitled-UI (react-aria) variant of {@link SearchDropdown}. Its popover renders
 * in the react-aria top layer, so it stays interactive inside a SlideoutMenu
 * drawer where an Ant Design popup (portaled to document.body) would become inert.
 */
const QuickFilterDropdown: FC<QuickFilterDropdownProps> = ({
  label,
  searchKey,
  options,
  selectedKeys,
  isSuggestionsLoading = false,
  hideCounts = false,
  hideSearchBar = false,
  hasNullOption = false,
  singleSelect = false,
  showSelectedCounts = false,
  independent = false,
  onChange,
  onSearch,
  onGetInitialOptions,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<
    SearchDropdownOption[]
  >([]);
  const [nullOptionSelected, setNullOptionSelected] = useState(false);

  const nullLabelText = t('label.no-entity', { entity: label });
  const searchPlaceholder = `${t('label.search-entity', { entity: label })}...`;

  const debouncedOnSearch = useMemo(
    () => debounce((value: string) => onSearch(value, searchKey), 500),
    [onSearch, searchKey]
  );

  useEffect(() => {
    setNullOptionSelected(
      selectedKeys.some((item) => item.key === NULL_OPTION_KEY)
    );
    setSelectedOptions(
      selectedKeys.filter((item) => item.key !== NULL_OPTION_KEY)
    );
  }, [selectedKeys, isOpen]);

  const displayedOptions = useMemo(() => {
    const selected = independent
      ? selectedOptions
      : options.filter((option) =>
          selectedOptions.some((selected) => selected.key === option.key)
        );
    const unselected = options.filter(
      (option) =>
        !selectedOptions.some((selected) => selected.key === option.key)
    );

    return [...selected, ...unselected];
  }, [options, selectedOptions, independent]);

  const isOptionSelected = (option: SearchDropdownOption) =>
    selectedOptions.some((selected) => selected.key === option.key);

  const showClearAllBtn = !singleSelect && selectedOptions.length > 1;

  const selectedLabel = showSelectedCounts
    ? `(${selectedKeys.length})`
    : getSelectedOptionLabelString(selectedKeys);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      onGetInitialOptions?.(searchKey);
      setSearchText('');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    debouncedOnSearch(value);
  };

  const handleOptionToggle = (option: SearchDropdownOption) => {
    if (singleSelect) {
      const isAlreadySelected = isOptionSelected(option);
      setSelectedOptions(isAlreadySelected ? [] : [option]);
      if (!isAlreadySelected) {
        setNullOptionSelected(false);
      }
    } else {
      setSelectedOptions((previous) =>
        previous.some((selected) => selected.key === option.key)
          ? previous.filter((selected) => selected.key !== option.key)
          : [...previous, option]
      );
    }
  };

  const handleNullOptionChange = (checked: boolean) => {
    setNullOptionSelected(checked);
    if (singleSelect && checked) {
      setSelectedOptions([]);
    }
  };

  const handleClear = () => {
    setSelectedOptions([]);
  };

  const handleApply = () => {
    const values = nullOptionSelected
      ? [
          { key: NULL_OPTION_KEY, label: nullLabelText },
          ...(singleSelect ? [] : selectedOptions),
        ]
      : selectedOptions;
    onChange(values, searchKey);
    setIsOpen(false);
  };

  return (
    <PopoverTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button
        color="secondary"
        data-testid={searchKey}
        iconTrailing={<ChevronDown className="tw:size-4" />}
        size="sm">
        <span data-testid={`search-dropdown-${label}`}>
          {label}
          {selectedKeys.length > 0 && (
            <span className="tw:text-brand-secondary">{`: ${selectedLabel}`}</span>
          )}
        </span>
      </Button>
      <Popover className="tw:w-72" placement="bottom left">
        <div className="tw:flex tw:flex-col" data-testid="drop-down-menu">
          {!hideSearchBar && (
            <div className="tw:p-2">
              <Input
                autoFocus
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                value={searchText}
                onChange={handleSearchChange}
              />
            </div>
          )}

          {hasNullOption && (
            <div className="tw:flex tw:items-center tw:px-3 tw:py-2">
              <Checkbox
                data-testid={
                  singleSelect ? 'no-option-radio' : 'no-option-checkbox'
                }
                isSelected={nullOptionSelected}
                label={nullLabelText}
                onChange={handleNullOptionChange}
              />
            </div>
          )}

          <div className="tw:max-h-64 tw:overflow-auto tw:px-1.5 tw:py-1">
            {isSuggestionsLoading ? (
              <div className="tw:flex tw:justify-center tw:py-3">
                <Loader size="small" />
              </div>
            ) : displayedOptions.length > 0 ? (
              displayedOptions.map((option) => (
                <div
                  className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:rounded-md tw:px-2 tw:py-1.5 tw:hover:bg-primary_hover"
                  key={option.key}>
                  <Checkbox
                    data-testid={`${option.label}-checkbox`}
                    isSelected={isOptionSelected(option)}
                    label={option.label}
                    onChange={() => handleOptionToggle(option)}
                  />
                  {!hideCounts && !isUndefined(option.count) && (
                    <span className="tw:text-xs tw:text-tertiary">
                      {option.count}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="tw:px-2 tw:py-3 tw:text-center tw:text-sm tw:text-tertiary">
                {t('message.no-data-available')}
              </div>
            )}
          </div>

          <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-secondary tw:p-2">
            {showClearAllBtn ? (
              <Button
                color="link-color"
                data-testid="clear-button"
                size="sm"
                onPress={handleClear}>
                {t('label.clear-entity', { entity: t('label.all') })}
              </Button>
            ) : (
              <span />
            )}
            <div className="tw:flex tw:gap-2">
              <Button
                color="secondary"
                data-testid="close-btn"
                size="sm"
                onPress={() => setIsOpen(false)}>
                {t('label.close')}
              </Button>
              <Button
                color="primary"
                data-testid="update-btn"
                size="sm"
                onPress={handleApply}>
                {t('label.update')}
              </Button>
            </div>
          </div>
        </div>
      </Popover>
    </PopoverTrigger>
  );
};

export default QuickFilterDropdown;
