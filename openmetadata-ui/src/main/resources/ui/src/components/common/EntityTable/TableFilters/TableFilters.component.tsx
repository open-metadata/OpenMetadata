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
import { Button, Space } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SearchIcon } from '../../../../assets/svg/ic-input-search.svg';
import SearchDropdown from '../../../SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../../../SearchDropdown/SearchDropdown.interface';
import { TableFilterOption, TableFilterProps } from './TableFilters.interface';

import './table-filters.less';

/**
 * Filter option interface for each filter type.
 */

const FILTER_CONFIGS = [
  { key: 'owners', label: 'Owner' },
  { key: 'glossaryTerms', label: 'Glossary Term' },
  { key: 'domainTypes', label: 'Domain Type' },
  { key: 'tags', label: 'Tags' },
] as const;

type FilterKey = typeof FILTER_CONFIGS[number]['key'];

/**
 * EntityTableFilter component for advanced table filtering UI using SearchDropdown.
 * @param filters - Current applied filters
 * @param options - Available options for each filter
 * @param queryFilter - Base query filter to apply
 * @param searchIndex - Search index to use for filtering
 * @param onFilterChange - Callback when filters are updated
 * @param onClearAll - Callback to clear all filters
 */
export const TableFilters = ({
  filters,
  options,
  queryFilter,
  searchIndex,
  onFilterChange,
  onClearAll,
}: TableFilterProps) => {
  const { t } = useTranslation();

  // Convert TableFilterOption to SearchDropdownOption
  const convertToSearchDropdownOptions = (
    filterOptions: TableFilterOption[]
  ): SearchDropdownOption[] => {
    return filterOptions.map((option) => ({
      key: option.key,
      label:
        option.count !== undefined
          ? `${option.label} (${option.count})`
          : option.label,
    }));
  };

  // Convert selected filter values to SearchDropdownOption format
  const getSelectedOptions = (filterKey: FilterKey): SearchDropdownOption[] => {
    return filters[filterKey].map((value) => ({
      key: value,
      label: value,
    }));
  };

  // Handle filter change from SearchDropdown
  const handleFilterChange = (
    selectedOptions: SearchDropdownOption[],
    filterKey: string
  ) => {
    const updatedFilters = {
      ...filters,
      [filterKey]: selectedOptions.map((option) => option.key),
    };
    onFilterChange(updatedFilters);
  };

  // Handle search functionality (placeholder for future implementation)
  const handleSearch = (searchText: string, filterKey: string) => {
    // This would typically trigger an API call to fetch filtered options
    // Placeholder for search functionality
  };

  // Handle getting initial options (placeholder for future implementation)
  const handleGetInitialOptions = (filterKey: string) => {
    // This would typically trigger an API call to fetch initial options
    // Placeholder for initial options loading
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((filterArray) => filterArray.length > 0),
    [filters]
  );

  return (
    <Space className="entity-table-filter-container" size={8}>
      {FILTER_CONFIGS.map(({ key, label }) => (
        <SearchDropdown
          isSuggestionsLoading={false}
          key={key}
          label={label}
          options={convertToSearchDropdownOptions(options[key])}
          prefix={<SearchIcon style={{ fontSize: 16, color: '#363636' }} />}
          searchKey={key}
          selectedKeys={getSelectedOptions(key)}
          triggerButtonSize="small"
          onChange={handleFilterChange}
          onGetInitialOptions={handleGetInitialOptions}
          onSearch={handleSearch}
        />
      ))}

      {hasActiveFilters && (
        <Button
          className="text-primary font-medium"
          size="small"
          type="link"
          onClick={onClearAll}>
          {t('label.clear-all')}
        </Button>
      )}
    </Space>
  );
};

export default TableFilters;
