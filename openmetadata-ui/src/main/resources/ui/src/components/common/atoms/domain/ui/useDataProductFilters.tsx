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

import { AssetsOfEntity } from '../../../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { DATAPRODUCT_FILTERS } from '../../../../../constants/DataProduct.constants';
import { SearchIndex } from '../../../../../enums/search.enum';
import { Aggregations } from '../../../../../interface/search.interface';
import { ExploreQuickFilterField } from '../../../../Explore/ExplorePage.interface';
import { useQuickFiltersWithComponent } from '../../filters/useQuickFiltersWithComponent';

interface UseDataProductFiltersConfig {
  aggregations?: Aggregations;
  parsedFilters?: ExploreQuickFilterField[];
  onFilterChange: (filters: ExploreQuickFilterField[]) => void;
}

export const useDataProductFilters = (config: UseDataProductFiltersConfig) => {
  const { quickFilters, selectedFilters } = useQuickFiltersWithComponent({
    defaultFilters: DATAPRODUCT_FILTERS,
    aggregations: config.aggregations,
    parsedFilters: config.parsedFilters,
    searchIndex: SearchIndex.DATA_PRODUCT,
    assetType: AssetsOfEntity.DATA_PRODUCT,
    onFilterChange: config.onFilterChange,
  });

  return {
    quickFilters,
    selectedFilters,
    defaultFilters: DATAPRODUCT_FILTERS,
  };
};
