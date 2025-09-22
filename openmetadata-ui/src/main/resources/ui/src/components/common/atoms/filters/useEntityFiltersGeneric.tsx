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

import { Box } from '@mui/material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SearchDropdown from '../../../SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../../../SearchDropdown/SearchDropdown.interface';

interface FilterConfig {
  key: string;
  labelKey: string;
  searchKey: string;
  options: SearchDropdownOption[];
  selectedOptions: SearchDropdownOption[];
  onChange: (values: string[]) => void;
  onSearch: (searchTerm: string) => void;
}

interface EntityFiltersGenericConfig {
  filters: FilterConfig[];
}

export const useEntityFiltersGeneric = (config: EntityFiltersGenericConfig) => {
  const { t } = useTranslation();

  // Inline implementation copying exact EntityFiltersGeneric functionality
  const entityFiltersGeneric = useMemo(
    () => (
      <Box sx={{ display: 'flex', gap: 4 }}>
        {config.filters.map((filter) => (
          <SearchDropdown
            key={filter.key}
            label={t(filter.labelKey)}
            options={filter.options}
            searchKey={filter.searchKey}
            selectedKeys={filter.selectedOptions}
            onChange={(values) => {
              filter.onChange(values.map((v) => v.key));
            }}
            onSearch={filter.onSearch}
          />
        ))}
      </Box>
    ),
    [config, t]
  );

  return {
    entityFiltersGeneric,
    hasActiveFilters: config.filters.some(
      (filter) => filter.selectedOptions.length > 0
    ),
    clearAllFilters: () =>
      config.filters.forEach((filter) => filter.onChange([])),
  };
};
