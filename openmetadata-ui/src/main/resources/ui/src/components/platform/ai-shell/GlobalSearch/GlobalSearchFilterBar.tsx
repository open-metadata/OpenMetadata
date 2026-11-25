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
import { Box, Divider } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { ExploreQuickFilterField } from '../../../../interface/quickFilter.interface';
import ExploreQuickFilters from '../../../Explore/ExploreQuickFilters';
import {
  GlobalSearchCategory,
  GlobalSearchFacetSelection,
} from './GlobalSearch.types';
import { getCategoryFilterConfig } from './GlobalSearchFilterBar.utils';

export interface GlobalSearchFilterBarProps {
  /** The active tab; nothing renders for "all" or types without filters. */
  category?: GlobalSearchCategory;
  query: string;
  facets: GlobalSearchFacetSelection;
  onFacetChange: (field: ExploreQuickFilterField) => void;
}

/** The active type's own filters (Explore's quick filters), narrowed to the query. */
const GlobalSearchFilterBar = ({
  category,
  query,
  facets,
  onFacetChange,
}: GlobalSearchFilterBarProps) => {
  const config = useMemo(
    () => (category ? getCategoryFilterConfig(category) : undefined),
    [category]
  );
  const fields = useMemo<ExploreQuickFilterField[]>(
    () =>
      config?.fields.map((field) => ({
        ...field,
        value: facets[field.key] ?? [],
      })) ?? [],
    [config, facets]
  );

  if (!config) {
    return null;
  }

  return (
    <>
      <Divider />
      <Box
        className="tw:overflow-x-auto tw:px-4 tw:pb-2"
        data-testid="global-search-filter-bar">
        <ExploreQuickFilters
          ignoreHostSearchState
          immediateApply
          singleLine
          fields={fields}
          index={config.index}
          searchText={query}
          onFieldValueSelect={onFacetChange}
        />
      </Box>
    </>
  );
};

export default GlobalSearchFilterBar;
