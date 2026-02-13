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

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { Aggregations } from '../../../../interface/search.interface';
import { ExploreQuickFilterField } from '../../../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../../../Explore/ExploreQuickFilters';
import { AssetsOfEntity } from '../../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';

interface QuickFiltersWithComponentConfig {
  defaultFilters: ExploreQuickFilterField[];
  aggregations?: Aggregations;
  parsedFilters?: ExploreQuickFilterField[];
  searchIndex: SearchIndex | SearchIndex[];
  assetType: AssetsOfEntity;
  onFilterChange: (filters: ExploreQuickFilterField[]) => void;
  additionalActions?: ReactNode;
}

export const useQuickFiltersWithComponent = (
  config: QuickFiltersWithComponentConfig
) => {
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<
    ExploreQuickFilterField[]
  >([]);

  useEffect(() => {
    // Use parsedFilters if available (from URL), otherwise use defaultFilters
    if (config.parsedFilters && config.parsedFilters.length > 0) {
      // Merge parsedFilters with defaultFilters to maintain structure
      const mergedFilters = config.defaultFilters.map((defaultFilter) => {
        const parsedFilter = config.parsedFilters?.find(
          (pf) => pf.key === defaultFilter.key
        );

        return parsedFilter || defaultFilter;
      });
      setSelectedQuickFilters(mergedFilters);
    } else {
      setSelectedQuickFilters(config.defaultFilters);
    }
  }, [config.defaultFilters, config.parsedFilters]);

  const handleQuickFiltersChange = useCallback(
    (data: ExploreQuickFilterField[]) => {
      config.onFilterChange(data);
    },
    [config.onFilterChange]
  );

  const handleQuickFiltersValueSelect = useCallback(
    (field: ExploreQuickFilterField) => {
      setSelectedQuickFilters((pre) => {
        const data = pre.map((preField) => {
          if (preField.key === field.key) {
            return field;
          } else {
            return preField;
          }
        });

        handleQuickFiltersChange(data);

        return data;
      });
    },
    [handleQuickFiltersChange]
  );

  const quickFilters = useMemo(
    () => (
      <ExploreQuickFilters
        showSelectedCounts
        additionalActions={config.additionalActions}
        aggregations={config.aggregations || {}}
        fields={selectedQuickFilters}
        index={config.searchIndex}
        showDeleted={false}
        onFieldValueSelect={handleQuickFiltersValueSelect}
      />
    ),
    [
      config.aggregations,
      config.searchIndex,
      config.additionalActions,
      selectedQuickFilters,
      handleQuickFiltersValueSelect,
    ]
  );

  return {
    quickFilters,
    selectedFilters: selectedQuickFilters,
  };
};
