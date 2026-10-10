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
  Autocomplete,
  Box,
  Button,
  FormSelectItem,
  Select,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DatePickerMenu from '../../common/DatePickerMenu/DatePickerMenu.component';
import { getClassicFilterItems } from './ClassicTestCaseFilter.utils';
import { FilterDescriptor } from './FilterChip.interface';

interface ClassicTestCaseFilterProps {
  filter: FilterDescriptor;
  className?: string;
  testId: string;
}

interface ClassicSingleSelectProps extends ClassicTestCaseFilterProps {
  items: FormSelectItem[];
  selectedKey: string | null;
}

const ClassicSingleSelect = ({
  filter,
  items,
  selectedKey,
  testId,
}: ClassicSingleSelectProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const visibleItems = filter.onSearch
    ? items
    : items.filter((item) =>
        (item.label ?? String(item.id))
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase())
      );
  const handleSearch = (value: string) => {
    setSearch(value);
    filter.onSearch?.(value);
  };
  const handleSelection = (key: string | number | null) => {
    if (key !== null) {
      filter.onChange(String(key));
    }
  };
  const renderItem = (item: FormSelectItem) => (
    <Select.Item id={item.id} supportingText={item.supportingText}>
      {item.label}
    </Select.Item>
  );
  const searchable =
    filter.searchable ||
    filter.key === 'tier' ||
    filter.key === 'dataQualityDimension';
  if (searchable) {
    return (
      <Select.ComboBox
        allowsEmptyCollection
        aria-busy={filter.isLoading}
        aria-label={filter.label}
        className="tw:min-w-0 tw:flex-1"
        data-testid={testId}
        defaultFilter={filter.onSearch ? () => true : undefined}
        emptyState={filter.isLoading ? t('label.loading') : undefined}
        fontSize="sm"
        items={visibleItems}
        menuTrigger="focus"
        placeholder={filter.label}
        selectedKey={selectedKey}
        shortcut={false}
        showSearchIcon={false}
        onInputChange={handleSearch}
        onOpenChange={(isOpen) => {
          if (isOpen) {
            setSearch('');
          }
        }}
        onSelectionChange={handleSelection}>
        {renderItem}
      </Select.ComboBox>
    );
  }

  return (
    <Select
      aria-label={filter.label}
      className="tw:min-w-0 tw:flex-1"
      data-testid={testId}
      fontSize="sm"
      items={items}
      placeholder={filter.label}
      selectedKey={selectedKey}
      onSelectionChange={handleSelection}>
      {renderItem}
    </Select>
  );
};

const ClassicMultipleSelect = ({
  filter,
  testId,
  items,
  selectedItems,
  selectedValues,
}: ClassicTestCaseFilterProps & ReturnType<typeof getClassicFilterItems>) => (
  <Box className="tw:min-w-0 tw:flex-1">
    <Autocomplete
      aria-busy={filter.isLoading}
      aria-label={filter.label}
      data-testid={testId}
      filterOption={filter.onSearch ? () => true : undefined}
      icon={null}
      items={items}
      placeholder={filter.label}
      selectedItems={selectedItems}
      onItemCleared={(key) =>
        filter.onChange(selectedValues.filter((value) => value !== String(key)))
      }
      onItemInserted={(key) =>
        filter.onChange([...new Set([...selectedValues, String(key)])])
      }
      onSearchChange={filter.onSearch}>
      {(item) => (
        <Autocomplete.Item id={item.id} textValue={item.label}>
          {item.label}
        </Autocomplete.Item>
      )}
    </Autocomplete>
  </Box>
);

export const ClassicTestCaseFilter = ({
  filter,
  className,
  testId,
}: ClassicTestCaseFilterProps) => {
  const { t } = useTranslation();
  const selection = getClassicFilterItems(filter);
  const dateValue =
    typeof filter.value === 'object' && !Array.isArray(filter.value)
      ? filter.value
      : undefined;

  return (
    <Box align="center" className={className} gap={2}>
      <Typography
        as="span"
        className="tw:shrink-0"
        size="text-sm"
        weight="medium">
        {filter.label}:
      </Typography>
      {filter.controlType === 'date' ? (
        <DatePickerMenu
          showSelectedCustomRange
          defaultDateRange={dateValue}
          handleDateRangeChange={filter.onChange}
          size="small"
        />
      ) : (
        <Box align="center" className="tw:min-w-0 tw:flex-1" gap={1}>
          {filter.controlType === 'multiselect' ? (
            <ClassicMultipleSelect
              filter={filter}
              testId={testId}
              {...selection}
            />
          ) : (
            <ClassicSingleSelect
              filter={filter}
              items={selection.items}
              selectedKey={selection.selectedValues[0] ?? null}
              testId={testId}
            />
          )}
          {selection.selectedValues.length > 0 && (
            <Tooltip title={t('label.clear')}>
              <Button
                aria-label={t('label.clear') + ' ' + filter.label}
                color="tertiary"
                iconLeading={XClose}
                size="xs"
                onPress={() => filter.onChange(undefined)}
              />
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
};
