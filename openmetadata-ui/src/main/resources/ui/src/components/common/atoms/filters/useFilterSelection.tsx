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

import {
  Badge,
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
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
      <div className="tw:flex tw:items-center tw:w-full">
        <div className="tw:flex tw:gap-2 tw:flex-wrap tw:flex-1">
          {selectedFilters.map((filter) => {
            const filterValues = filter.values.join(', ');

            return (
              <Badge
                className="tw:ring-0 tw:gap-1"
                color="brand"
                key={filter.key}
                size="lg"
                type="color">
                <div
                  className="tw:flex tw:items-center tw:gap-1"
                  data-testid={`filter-chip-${filter.key}`}>
                  <Typography className="tw:text-gray-600" weight="medium">
                    {t(filter.label)}
                    {': '}
                  </Typography>
                  <div className="tw:max-w-80">
                    <Typography
                      ellipsis
                      as="p"
                      className="tw:text-brand-600"
                      title={filterValues}
                      weight="medium">
                      {filterValues}
                    </Typography>
                  </div>
                </div>
                <ButtonUtility
                  aria-label="Remove filter"
                  color="tertiary"
                  icon={<XClose size={14} />}
                  onClick={() => handleRemoveFilter(filter.key)}
                />
              </Badge>
            );
          })}
        </div>
        <Button color="link-color" onClick={handleClearAll}>
          {t('label.clear-entity', { entity: t('label.all-lowercase') })}
        </Button>
      </div>
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
