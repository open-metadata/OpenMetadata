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

import { Box, Paper, TableContainer, useTheme } from '@mui/material';
import { useFilterConfig } from '../../common/atoms/filters/useFilterConfig';
import { useFilterDropdowns } from '../../common/atoms/filters/useFilterDropdowns';
import { useSearch } from '../../common/atoms/navigation/useSearch';
import { useTitleAndCount } from '../../common/atoms/navigation/useTitleAndCount';
import { usePaginationControls } from '../../common/atoms/pagination/usePaginationControls';
import { SUBDOMAIN_FILTER_CONFIGS } from '../../common/atoms/shared/utils/commonFilterConfigs';
import { useDataTable } from '../../common/atoms/table/useDataTable';
import { useSubdomainListingData } from './hooks/useSubdomainListingData';
import { SubDomainsTableProps } from './SubDomainsTable.interface';

const SubDomainsTable = ({
  domainFqn,
  permissions,
  onAddSubDomain,
}: SubDomainsTableProps) => {
  const theme = useTheme();
  const subdomainListing = useSubdomainListingData({
    parentDomainFqn: domainFqn,
  });

  const { dropdownConfigs } = useFilterConfig({
    filterConfigs: SUBDOMAIN_FILTER_CONFIGS,
    filterOptions: subdomainListing.filterOptions || {},
    selectedFilters: subdomainListing.urlState.filters,
    onFilterChange: subdomainListing.handleFilterChange,
    onFilterSearch: subdomainListing.searchFilterOptions,
  });

  const { titleAndCount } = useTitleAndCount({
    titleKey: 'label.sub-domain-plural',
    count: subdomainListing.totalEntities,
    loading: subdomainListing.loading,
  });

  const { search } = useSearch({
    searchPlaceholder: 'Search subdomains',
    onSearchChange: subdomainListing.handleSearchChange,
    initialSearchQuery: subdomainListing.urlState.searchQuery,
  });

  const { filterDropdowns } = useFilterDropdowns({
    filters: dropdownConfigs,
  });

  const { dataTable } = useDataTable({
    listing: subdomainListing,
    enableSelection: true,
    entityLabelKey: 'label.sub-domain',
  });

  const { paginationControls } = usePaginationControls({
    currentPage: subdomainListing.currentPage,
    totalPages: subdomainListing.totalPages,
    totalEntities: subdomainListing.totalEntities,
    pageSize: subdomainListing.pageSize,
    onPageChange: subdomainListing.handlePageChange,
    loading: subdomainListing.loading,
  });

  return (
    <TableContainer component={Paper} sx={{ mb: 5 }}>
      <Box
        sx={{
          display: 'flex',
          gap: 5,
          alignItems: 'center',
          px: 6,
          py: 4,
          borderBottom: `1px solid`,
          borderColor: theme.palette.allShades?.gray?.[200],
        }}>
        {titleAndCount}
        {search}
        {filterDropdowns}
      </Box>

      {dataTable}

      {paginationControls}
    </TableContainer>
  );
};

export default SubDomainsTable;
