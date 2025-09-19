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
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_MESSAGE } from '../../constants/constants';
import { CreateDataProduct } from '../../generated/api/domains/createDataProduct';
import { withPageLayout } from '../../hoc/withPageLayout';
import { addDataProducts } from '../../rest/dataProductAPI';
import { getIsErrorMatch } from '../../utils/CommonUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useDelete } from '../common/atoms/actions/useDelete';
import { useDomainCardTemplates } from '../common/atoms/domain/ui/useDomainCardTemplates';
import { useFormDrawerWithRef } from '../common/atoms/drawer';
import { useFilterConfig } from '../common/atoms/filters/useFilterConfig';
import { useFilterDropdowns } from '../common/atoms/filters/useFilterDropdowns';
import { useBreadcrumbs } from '../common/atoms/navigation/useBreadcrumbs';
import { usePageHeader } from '../common/atoms/navigation/usePageHeader';
import { useSearch } from '../common/atoms/navigation/useSearch';
import { useTitleAndCount } from '../common/atoms/navigation/useTitleAndCount';
import { useViewToggle } from '../common/atoms/navigation/useViewToggle';
import { usePaginationControls } from '../common/atoms/pagination/usePaginationControls';
import { DATA_PRODUCT_FILTER_CONFIGS } from '../common/atoms/shared/utils/commonFilterConfigs';
import { useCardView } from '../common/atoms/table/useCardView';
import { useDataTable } from '../common/atoms/table/useDataTable';
import AddDomainForm from '../Domain/AddDomainForm/AddDomainForm.component';
import { DomainFormType } from '../Domain/DomainPage.interface';
import { useDataProductListingData } from './hooks/useDataProductListingData';

const DataProductListPage = () => {
  const dataProductListing = useDataProductListingData();
  const theme = useTheme();
  const { t } = useTranslation();
  const [form] = useForm();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: CreateDataProduct) => {
    setIsLoading(true);
    try {
      await addDataProducts(formData);
      showSuccessToast(
        t('server.create-entity-success', {
          entity: t('label.data-product'),
        })
      );
      dataProductListing.refetch();
    } catch (error) {
      showErrorToast(
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
          ? t('server.entity-already-exist', {
              entity: t('label.data-product'),
              entityPlural: 'data-products',
              name: formData.name,
            })
          : (error as AxiosError),
        t('server.add-entity-error', {
          entity: t('label.data-product').toLowerCase(),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const { formDrawer, openDrawer } = useFormDrawerWithRef({
    title: t('label.add-entity', { entity: t('label.data-product') }),
    anchor: 'right',
    width: 750,
    closeOnEscape: false,
    form: (
      <AddDomainForm
        isFormInDialog
        formRef={form}
        loading={isLoading}
        type={DomainFormType.DATA_PRODUCT}
        onCancel={() => {
          // No-op: Drawer close is handled by useFormDrawerWithRef
        }}
        onSubmit={handleSubmit}
      />
    ),
    formRef: form,
    onSubmit: handleSubmit,
    loading: isLoading,
  });

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
    onAddClick: openDrawer,
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

  const { view, viewToggle } = useViewToggle();
  const { dataProductCardTemplate } = useDomainCardTemplates();

  const { dataTable } = useDataTable({
    listing: dataProductListing,
    enableSelection: true,
    entityLabelKey: 'label.data-product',
  });

  const { cardView } = useCardView({
    listing: dataProductListing,
    cardTemplate: dataProductCardTemplate,
  });

  const { paginationControls } = usePaginationControls({
    currentPage: dataProductListing.currentPage,
    totalPages: dataProductListing.totalPages,
    totalEntities: dataProductListing.totalEntities,
    pageSize: dataProductListing.pageSize,
    onPageChange: dataProductListing.handlePageChange,
    loading: dataProductListing.loading,
  });

  const { deleteIconButton, deleteModal } = useDelete({
    entityType: 'dataProducts',
    entityLabel: 'Data Product',
    selectedEntities: dataProductListing.selectedEntities,
    onDeleteComplete: () => {
      dataProductListing.clearSelection();
      dataProductListing.refetch();
    },
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
          <Box ml="auto" />
          {viewToggle}
          {deleteIconButton}
        </Box>

        {view === 'table' ? dataTable : cardView}

        {paginationControls}
      </TableContainer>
      {deleteModal}
      {formDrawer}
    </>
  );
};

export default withPageLayout(DataProductListPage);
