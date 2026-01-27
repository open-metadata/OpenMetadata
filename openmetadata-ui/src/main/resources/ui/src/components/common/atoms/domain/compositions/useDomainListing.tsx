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
import {
  DOMAIN_DEFAULT_QUICK_FILTERS,
  DOMAIN_FILTERS,
  SUBDOMAIN_DEFAULT_QUICK_FILTERS,
  SUB_DOMAIN_FILTERS,
} from '../../../../../constants/Domain.constants';
import { SearchIndex } from '../../../../../enums/search.enum';
import { Domain } from '../../../../../generated/entity/domains/domain';
import { useListingData } from '../../compositions/useListingData';
import { CellRenderer, ColumnConfig, ListingData } from '../../shared/types';
import { useDomainColumns } from '../ui/useDomainColumns';
import { useDomainRenderers } from '../ui/useDomainRenderers';

interface UseDomainListingConfig {
  baseFilter?: string;
  nameLabelKey?: string;
  pageSize?: number;
  basePath?: string;
  includeOwners?: boolean;
  includeGlossaryTerms?: boolean;
  includeDomainType?: boolean;
  includeClassificationTags?: boolean;
  customColumns?: ColumnConfig<Domain>[];
  customRenderers?: CellRenderer<Domain>;
  isSubDomain?: boolean;
  searchKey?: string;
}

export const useDomainListing = (
  config: UseDomainListingConfig = {}
): ListingData<Domain> => {
  const {
    searchKey = 'q',
    baseFilter = '',
    nameLabelKey = 'label.domain',
    pageSize = TABLE_CARD_PAGE_SIZE,
    basePath = '/domain',
    includeOwners = true,
    includeGlossaryTerms = true,
    includeDomainType = true,
    includeClassificationTags = true,
    customColumns = [],
    customRenderers = {},
    isSubDomain = false,
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

  // Use domain-specific atoms with stable configurations
  const { columns } = useDomainColumns(domainColumnsConfig);
  const { renderers } = useDomainRenderers(domainRenderersConfig);
  // Define filterKeys for domain filters
  const filterKeys = useMemo(
    () =>
      isSubDomain
        ? SUBDOMAIN_DEFAULT_QUICK_FILTERS
        : DOMAIN_DEFAULT_QUICK_FILTERS,
    [isSubDomain]
  );
  const filterConfigs = useMemo(
    () => (isSubDomain ? SUB_DOMAIN_FILTERS : DOMAIN_FILTERS),
    [isSubDomain]
  );

  // Use generic listing composition with domain-specific configuration
  const listingData = useListingData<Domain>({
    searchIndex: SearchIndex.DOMAIN,
    baseFilter,
    pageSize,
    filterKeys,
    filterConfigs,
    columns,
    renderers,
    basePath,
    searchKey,
  });

  return listingData;
};
