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
import { Box, Button, Dropdown, Input } from '@openmetadata/ui-core-components';
import { ChevronDown, SearchLg } from '@untitledui/icons';
import { Key, useMemo, useState } from 'react';
import type { Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { DqSearchFilterProps } from '../../../DataQuality/DataQualityDashboard/useDataQualityDashboardFilters';
import { SearchDropdownOption } from '../../../SearchDropdown/SearchDropdown.interface';
import { chipLabel } from './dqFilterChip.utils';

const DqSearchFilterChip = ({
  label,
  searchKey,
  searchProps,
  isOpen,
  onOpenChange,
}: {
  label: string;
  searchKey: string;
  searchProps: DqSearchFilterProps;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  // Selections are staged locally and only committed on Apply, so picking
  // options does not trigger a data refetch per click.
  const [stagedOptions, setStagedOptions] = useState<SearchDropdownOption[]>(
    searchProps.selectedKeys
  );
  const { options, selectedKeys, onChange, onGetInitialOptions, onSearch } =
    searchProps;

  const stagedKeySet = useMemo<Selection>(
    () => new Set(stagedOptions.map((option) => option.key)),
    [stagedOptions]
  );

  // Surface staged selections that aren't part of the freshly fetched page so a
  // persisted selection still renders as checked in the menu (mirrors the shared
  // FilterChip behavior).
  const mergedOptions = useMemo(() => {
    const known = new Set(options.map((option) => option.key));
    const missing = stagedOptions.filter((option) => !known.has(option.key));

    return missing.length > 0 ? [...missing, ...options] : options;
  }, [options, stagedOptions]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setStagedOptions(selectedKeys);
      onGetInitialOptions();
    } else {
      setQuery('');
    }
    onOpenChange(open);
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const handleSelectionChange = (keys: Selection) => {
    if (keys === 'all') {
      return;
    }
    const optionByKey = new Map<Key, SearchDropdownOption>();
    [...stagedOptions, ...options].forEach((option) =>
      optionByKey.set(option.key, option)
    );
    setStagedOptions(
      Array.from(keys)
        .map((key) => optionByKey.get(key))
        .filter((option): option is SearchDropdownOption => Boolean(option))
    );
  };

  const handleClear = () => setStagedOptions([]);

  const handleCancel = () => handleOpenChange(false);

  const handleApply = () => {
    onChange(stagedOptions);
    handleOpenChange(false);
  };

  return (
    <Dropdown.Root isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button
        className="tw:whitespace-nowrap"
        color="secondary"
        data-testid={`search-dropdown-${searchKey}`}
        iconTrailing={ChevronDown}
        size="md">
        {chipLabel(label, selectedKeys.length)}
      </Button>
      <Dropdown.Popover className="tw:w-64">
        <div className="tw:p-2">
          <Input
            icon={SearchLg}
            placeholder={t('label.search')}
            size="sm"
            value={query}
            onChange={handleSearch}
          />
        </div>
        <Dropdown.Menu
          aria-label={label}
          className="tw:max-h-64 tw:overflow-y-auto"
          disallowEmptySelection={false}
          selectedKeys={stagedKeySet}
          selectionMode="multiple"
          onSelectionChange={handleSelectionChange}>
          {mergedOptions.map((option) => (
            <Dropdown.Item
              showCheckbox
              id={option.key}
              key={option.key}
              label={option.label}
              textValue={option.label}
            />
          ))}
        </Dropdown.Menu>
        <Box
          align="center"
          className="tw:border-t tw:border-secondary tw:p-2"
          gap={2}
          justify="between">
          <Button
            color="tertiary"
            data-testid="clear-filter-btn"
            isDisabled={stagedOptions.length === 0}
            size="sm"
            onPress={handleClear}>
            {t('label.clear')}
          </Button>
          <Box align="center" gap={2}>
            <Button
              color="secondary"
              data-testid="cancel-filter-btn"
              size="sm"
              onPress={handleCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="apply-filter-btn"
              size="sm"
              onPress={handleApply}>
              {t('label.apply')}
            </Button>
          </Box>
        </Box>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default DqSearchFilterChip;
