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

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchDropdownOption } from '../../../SearchDropdown/SearchDropdown.interface';
import { useEntityFiltersGeneric } from './useEntityFiltersGeneric';

interface FilterDropdownsConfig {
  filters: Array<{
    key: string;
    labelKey: string;
    searchKey: string;
    options: any[];
    selectedOptions: any[];
    onChange: (values: string[]) => void;
    onSearch: (term: string) => void;
  }>;
}

export const useFilterDropdowns = (config: FilterDropdownsConfig) => {
  const { t } = useTranslation();

  // Convert our filter format to the format expected by useEntityFiltersGeneric
  const convertedFilters = useMemo(() => {
    return config.filters.map((filter) => ({
      key: filter.key,
      labelKey: filter.labelKey,
      searchKey: filter.searchKey,
      options: filter.options.map(
        (option): SearchDropdownOption => ({
          key: option.key || option.label || option,
          label: option.label || option.key || option,
          count: option.count || 0,
        })
      ),
      selectedOptions: filter.selectedOptions.map(
        (option): SearchDropdownOption => ({
          key: typeof option === 'string' ? option : option.key || option.label,
          label:
            typeof option === 'string' ? option : option.label || option.key,
          count: typeof option === 'object' ? option.count || 0 : 0,
        })
      ),
      onChange: filter.onChange,
      onSearch: filter.onSearch,
    }));
  }, [config.filters]);

  const { entityFiltersGeneric, hasActiveFilters, clearAllFilters } =
    useEntityFiltersGeneric({
      filters: convertedFilters,
    });

  return {
    filterDropdowns: entityFiltersGeneric,
    clearAllFilters,
    hasActiveFilters,
    filterCount: config.filters.length,
  };
};
