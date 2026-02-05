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

import { useMemo } from 'react';
import { useQuickFiltersWithComponent } from '../../../../components/common/atoms/filters/useQuickFiltersWithComponent';
import { ExploreQuickFilterField } from '../../../../components/Explore/ExplorePage.interface';
import { AssetsOfEntity } from '../../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { SearchIndex } from '../../../../enums/search.enum';
import { Aggregations } from '../../../../interface/search.interface';
import { COLUMN_GRID_FILTERS } from '../constants/ColumnGrid.constants';

interface UseColumnGridFiltersConfig {
  aggregations?: Aggregations;
  parsedFilters?: ExploreQuickFilterField[];
  onFilterChange: (filters: ExploreQuickFilterField[]) => void;
}

// Indexes that have columns with tags (using columns.tags.tagFQN path)
const COLUMN_SEARCH_INDEXES = [
  SearchIndex.TABLE,
  SearchIndex.DASHBOARD_DATA_MODEL,
  SearchIndex.TOPIC,
  SearchIndex.CONTAINER,
  SearchIndex.SEARCH_INDEX,
] as SearchIndex[];

export const useColumnGridFilters = (config: UseColumnGridFiltersConfig) => {
  const { aggregations, parsedFilters, onFilterChange } = config;

  const defaultFilters = useMemo(() => COLUMN_GRID_FILTERS, []);

  const { quickFilters } = useQuickFiltersWithComponent({
    defaultFilters,
    aggregations,
    parsedFilters,
    searchIndex: COLUMN_SEARCH_INDEXES,
    assetType: AssetsOfEntity.COLUMN,
    onFilterChange,
  });

  return {
    quickFilters,
    defaultFilters,
  };
};
