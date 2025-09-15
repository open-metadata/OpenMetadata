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
import { TABLE_CARD_PAGE_SIZE } from '../../../../../constants/constants';
import { SearchIndex } from '../../../../../enums/search.enum';
import { Domain } from '../../../../../generated/entity/domains/domain';
import { useListingData } from '../../compositions/useListingData';
import { CellRenderer, ColumnConfig, ListingData } from '../../shared/types';
import { useDomainColumns } from '../ui/useDomainColumns';
import { useDomainFilters } from '../ui/useDomainFilters';
import { useDomainRenderers } from '../ui/useDomainRenderers';

interface UseDomainListingConfig {
  baseFilter?: string;
  nameLabelKey?: string;
  pageSize?: number;
  basePath?: string;
  enabledFilters?: string[];
  includeOwners?: boolean;
  includeGlossaryTerms?: boolean;
  includeDomainType?: boolean;
  includeClassificationTags?: boolean;
  customColumns?: ColumnConfig<Domain>[];
  customRenderers?: CellRenderer<Domain>;
}

export const useDomainListing = (
  config: UseDomainListingConfig = {}
): ListingData<Domain> => {
  const {
    baseFilter = '!_exists_:parent',
    nameLabelKey = 'label.domain',
    pageSize = TABLE_CARD_PAGE_SIZE,
    basePath = '/domain',
    enabledFilters = ['owner', 'tags', 'glossary', 'domainType'],
    includeOwners = true,
    includeGlossaryTerms = true,
    includeDomainType = true,
    includeClassificationTags = true,
    customColumns = [],
    customRenderers = {},
  } = config;

  // Memoize domain atom configurations to ensure stability (like DataProduct pattern)
  const domainColumnsConfig = useMemo(
    () => ({
      nameLabelKey,
      includeOwners,
      includeGlossaryTerms,
      includeDomainType,
      includeClassificationTags,
      customColumns,
    }),
    [
      nameLabelKey,
      includeOwners,
      includeGlossaryTerms,
      includeDomainType,
      includeClassificationTags,
      customColumns,
    ]
  );

  const domainRenderersConfig = useMemo(
    () => ({
      includeDomainTypeChip: includeDomainType,
      customRenderers,
    }),
    [includeDomainType, customRenderers]
  );

  const domainFiltersConfig = useMemo(
    () => ({
      enabledFilters,
    }),
    [enabledFilters]
  );

  // Use domain-specific atoms with stable configurations
  const { columns } = useDomainColumns(domainColumnsConfig);
  const { renderers } = useDomainRenderers(domainRenderersConfig);
  const { filterKeys, queryConfig, filterFields, filterConfigs } =
    useDomainFilters(domainFiltersConfig);

  // Use generic listing composition with domain-specific configuration
  const listingData = useListingData<Domain>({
    searchIndex: SearchIndex.DOMAIN,
    baseFilter,
    pageSize,
    filterKeys,
    filterFields,
    queryConfig,
    columns,
    renderers,
    basePath,
  });

  return {
    ...listingData,
    // Add domain-specific metadata
    filterConfigs,
  };
};
