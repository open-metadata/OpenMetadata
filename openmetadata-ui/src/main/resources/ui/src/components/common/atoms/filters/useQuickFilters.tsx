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

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../../enums/search.enum';
import { Aggregations } from '../../../../interface/search.interface';
import { ExploreQuickFilterField } from '../../../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../../../Explore/ExploreQuickFilters';
import { FilterConfig, FilterField } from '../shared/types';

interface QuickFiltersConfig {
  filterFields: FilterField[];
  filterConfigs: FilterConfig[];
  queryConfig: Record<string, string>;
  onFilterChange: (filterKey: string, values: string[]) => void;
  aggregations: Aggregations;
  searchIndex: SearchIndex;
  independent?: boolean;
}

export const useQuickFilters = (config: QuickFiltersConfig) => {
  const { t } = useTranslation();

  const initialFilters = useMemo(
    () =>
      config.filterFields.map((field) => {
        const filterConfig = config.filterConfigs.find(
          (fc) => fc.key === field.key
        );

        return {
          key: field.aggregationField,
          label: filterConfig ? t(filterConfig.labelKey) : field.key,
          value: [],
        };
      }),
    [config.filterFields, config.filterConfigs, t]
  );

  const [selectedQuickFilters, setSelectedQuickFilters] =
    useState<ExploreQuickFilterField[]>(initialFilters);

  const getFilterKeyFromField = useCallback(
    (fieldKey: string): string => {
      // Reverse lookup from aggregationField to filter key
      const entry = Object.entries(config.queryConfig).find(
        ([, value]) => value === fieldKey
      );

      return entry ? entry[0] : fieldKey;
    },
    [config.queryConfig]
  );

  const handleQuickFiltersValueSelect = useCallback(
    (field: ExploreQuickFilterField) => {
      setSelectedQuickFilters((prev) => {
        const data = prev.map((prevField) => {
          if (prevField.key === field.key) {
            return field;
          }

          return prevField;
        });

        const filterKey = getFilterKeyFromField(field.key);
        config.onFilterChange(filterKey, field.value?.map((v) => v.key) || []);

        return data;
      });
    },
    [config.onFilterChange, getFilterKeyFromField]
  );

  const quickFilters = useMemo(
    () => (
      <ExploreQuickFilters
        aggregations={config.aggregations}
        fields={selectedQuickFilters}
        independent={config.independent}
        index={config.searchIndex}
        onFieldValueSelect={handleQuickFiltersValueSelect}
      />
    ),
    [
      config.independent,
      config.aggregations,
      config.searchIndex,
      selectedQuickFilters,
      handleQuickFiltersValueSelect,
    ]
  );

  return {
    quickFilters,
    selectedQuickFilters,
    handleQuickFiltersValueSelect,
  };
};
