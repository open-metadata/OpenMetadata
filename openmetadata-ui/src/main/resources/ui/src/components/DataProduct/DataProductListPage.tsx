/*
 *  Copyright 2023 Collate.
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
import { withPageLayout } from '../../hoc/withPageLayout';
import { useFilterConfig } from '../common/atoms/filters/useFilterConfig';
import { useFilterDropdowns } from '../common/atoms/filters/useFilterDropdowns';
import { useBreadcrumbs } from '../common/atoms/navigation/useBreadcrumbs';
import { usePageHeader } from '../common/atoms/navigation/usePageHeader';
import { useSearch } from '../common/atoms/navigation/useSearch';
import { useTitleAndCount } from '../common/atoms/navigation/useTitleAndCount';
import { usePaginationControls } from '../common/atoms/pagination/usePaginationControls';
import { DATA_PRODUCT_FILTER_CONFIGS } from '../common/atoms/shared/utils/commonFilterConfigs';
import { useDataTable } from '../common/atoms/table/useDataTable';
import { useDataProductListingData } from './hooks/useDataProductListingData';

const DataProductListPage = () => {
  const dataProductListing = useDataProductListingData();
  const theme = useTheme();

  const { dropdownConfigs } = useFilterConfig({
    filterConfigs: DATA_PRODUCT_FILTER_CONFIGS,
    filterOptions: dataProductListing.filterOptions || {},
    selectedFilters: dataProductListing.urlState.filters,
    onFilterChange: dataProductListing.handleFilterChange,
    onFilterSearch: dataProductListing.searchFilterOptions,
  });

  // Composable hooks for each UI component
  const { breadcrumbs } = useBreadcrumbs({
    entityLabelKey: 'label.data-product',
    basePath: '/dataProduct',
  });

  const { pageHeader } = usePageHeader({
    titleKey: 'label.data-product',
    descriptionMessageKey: 'message.data-product-description',
    createPermission: true,
    addButtonLabelKey: 'label.add-data-product',
    onAddClick: dataProductListing.actionHandlers.onAddClick,
  });

  const { titleAndCount } = useTitleAndCount({
    titleKey: 'label.data-product',
    count: dataProductListing.totalEntities,
    loading: dataProductListing.loading,
  });

  const { search } = useSearch({
    searchPlaceholderKey: 'label.search',
    onSearchChange: dataProductListing.handleSearchChange,
    initialSearchQuery: dataProductListing.urlState.searchQuery,
  });

  const { filterDropdowns } = useFilterDropdowns({
    filters: dropdownConfigs,
  });

  const { dataTable } = useDataTable({
    listing: dataProductListing,
    enableSelection: true,
    entityLabelKey: 'label.data-product',
  });

  const { paginationControls } = usePaginationControls({
    currentPage: dataProductListing.currentPage,
    totalPages: dataProductListing.totalPages,
    totalEntities: dataProductListing.totalEntities,
    pageSize: dataProductListing.pageSize,
    onPageChange: dataProductListing.handlePageChange,
    loading: dataProductListing.loading,
  });

  return (
    <>
      {breadcrumbs}
      {pageHeader}

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
    </>
  );
};

export default withPageLayout(DataProductListPage);
