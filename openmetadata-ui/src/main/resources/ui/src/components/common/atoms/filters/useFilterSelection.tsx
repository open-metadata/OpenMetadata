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

import { Box, Button } from '@mui/material';
import { XClose } from '@untitledui/icons';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExploreQuickFilterField } from '../../../Explore/ExplorePage.interface';
import { UrlState } from '../shared/types';
import './FilterSelection.less';

interface FilterConfig {
  label: string;
  key: string;
}

interface FilterSelectionConfig {
  urlState: UrlState;
  filterConfigs: FilterConfig[];
  parsedFilters?: ExploreQuickFilterField[];
  onFilterChange: (filters: ExploreQuickFilterField[]) => void;
}

interface FilterSelectionItem {
  key: string;
  label: string;
  values: string[];
}

export const useFilterSelection = (config: FilterSelectionConfig) => {
  const { t } = useTranslation();
  const { urlState, filterConfigs, parsedFilters, onFilterChange } = config;

  const selectedFilters = useMemo<FilterSelectionItem[]>(() => {
    const filters: FilterSelectionItem[] = [];

    // Use parsedFilters if available for consistent values
    if (parsedFilters) {
      parsedFilters.forEach((filter) => {
        if (filter.value && filter.value.length > 0) {
          filters.push({
            key: filter.key,
            label: filter.label,
            values: filter.value.map((v) => v.label || v.key),
          });
        }
      });
    } else {
      // Fallback to urlState.filters
      Object.entries(urlState.filters).forEach(([filterKey, values]) => {
        if (values && values.length > 0) {
          const filterConfig = filterConfigs.find((fc) => fc.key === filterKey);
          if (filterConfig) {
            filters.push({
              key: filterKey,
              label: filterConfig.label,
              values,
            });
          }
        }
      });
    }

    return filters;
  }, [urlState.filters, filterConfigs, parsedFilters]);

  const handleRemoveFilter = useCallback(
    (filterKey: string) => {
      const newFilters: ExploreQuickFilterField[] = filterConfigs.map((fc) => ({
        key: fc.key,
        label: fc.label,
        value:
          fc.key === filterKey
            ? []
            : urlState.filters[fc.key]?.map((v) => ({
                key: v,
                label: v,
              })) || [],
      }));

      onFilterChange(newFilters);
    },
    [filterConfigs, urlState.filters, onFilterChange]
  );

  const handleClearAll = useCallback(() => {
    const clearedFilters: ExploreQuickFilterField[] = filterConfigs.map(
      (fc) => ({
        key: fc.key,
        label: fc.label,
        value: [],
      })
    );

    onFilterChange(clearedFilters);
  }, [filterConfigs, onFilterChange]);

  const filterSelectionDisplay = useMemo(() => {
    if (selectedFilters.length === 0) {
      return null;
    }

    return (
      <Box className="filter-selection-container">
        <Box className="filter-selection-chips-wrapper">
          {selectedFilters.map((filter) => (
            <Box className="filter-selection-chip" key={filter.key}>
              <Box className="filter-selection-chip-content" component="span">
                <span className="filter-selection-label">
                  {t(filter.label)}
                  {': '}
                </span>
                <span
                  className="filter-selection-value"
                  title={filter.values.join(', ')}>
                  {filter.values.join(', ')}
                </span>
              </Box>
              <Box
                aria-label="Remove filter"
                className="filter-selection-remove-btn"
                component="button"
                onClick={() => handleRemoveFilter(filter.key)}>
                <XClose size={14} />
              </Box>
            </Box>
          ))}
        </Box>
        <Button
          className="filter-selection-clear-all"
          variant="text"
          onClick={handleClearAll}>
          {t('label.clear-entity', { entity: t('label.all-lowercase') })}
        </Button>
      </Box>
    );
  }, [selectedFilters, handleRemoveFilter, handleClearAll, t]);

  return {
    selectedFilters,
    filterSelectionDisplay,
    handleRemoveFilter,
    handleClearAll,
    hasFilters: selectedFilters.length > 0,
  };
};
