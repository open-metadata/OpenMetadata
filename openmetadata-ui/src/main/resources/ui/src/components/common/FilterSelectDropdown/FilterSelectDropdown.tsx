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
import { FilterSelect } from '@openmetadata/ui-core-components';
import { debounce } from 'lodash';
import { FC, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NULL_OPTION_KEY } from '../../../constants/AdvancedSearch.constants';
import type { SearchDropdownProps } from '../../SearchDropdown/SearchDropdown.interface';

/**
 * Drop-in replacement for the legacy AntD SearchDropdown: same props surface,
 * rendered through the unified FilterSelect core component. Translates the
 * option-object contract (SearchDropdownOption[], onChange(options, key)) to
 * FilterSelect's value-based one and debounces search like the legacy
 * dropdown did internally. Legacy AntD-only props (getPopupContainer,
 * dropdownClassName, triggerButtonSize, index, highlight) are ignored.
 */
const FilterSelectDropdown: FC<SearchDropdownProps> = ({
  label,
  searchKey,
  options,
  selectedKeys,
  isSuggestionsLoading,
  singleSelect,
  hideCounts,
  hideSearchBar,
  hasNullOption,
  immediateApply,
  helperText,
  onChange,
  onGetInitialOptions,
  onSearch,
}) => {
  const { t } = useTranslation();

  const nullOption = hasNullOption
    ? { value: NULL_OPTION_KEY, label: t('label.no-entity', { entity: label }) }
    : undefined;

  // The legacy dropdown debounced its own search input; FilterSelect reports
  // every keystroke. A keystroke still pending on close must not fire either.
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string, key: string) => {
        onSearchRef.current(value, key);
      }, 500),
    []
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const handleChange = (values: string[]) => {
    // Keep the option objects (labels, counts) for values that stay selected;
    // a value with no known option keeps its key as label.
    const knownOptions = new Map(
      [...selectedKeys, ...options].map((option) => [option.key, option])
    );
    onChange(
      values.map((value) => {
        if (value === NULL_OPTION_KEY && nullOption) {
          return { key: NULL_OPTION_KEY, label: nullOption.label };
        }

        return knownOptions.get(value) ?? { key: value, label: value };
      }),
      searchKey
    );
  };

  return (
    <FilterSelect
      commitMode={immediateApply ? 'immediate' : 'staged'}
      data-testid={`search-dropdown-${searchKey}`}
      helperText={helperText}
      hideCounts={hideCounts ?? false}
      isLoading={isSuggestionsLoading}
      label={label}
      nullOption={nullOption}
      options={options.map((option) => ({
        value: option.key,
        label: option.label,
        textValue: option.label,
        count: option.count,
        icon: option.icon,
      }))}
      resolveMissingLabel={(value) =>
        selectedKeys.find((option) => option.key === value)?.label ?? value
      }
      searchable={!(hideSearchBar ?? false)}
      selectedValues={selectedKeys.map((option) => option.key)}
      selectionMode={singleSelect ? 'single' : 'multiple'}
      showSelectAll={!singleSelect}
      triggerVariant="button"
      onChange={handleChange}
      onOpenChange={(open) => {
        if (open) {
          onGetInitialOptions?.(searchKey);
        } else {
          debouncedSearch.cancel();
        }
      }}
      onSearch={(value) => debouncedSearch(value, searchKey)}
    />
  );
};

export default FilterSelectDropdown;
