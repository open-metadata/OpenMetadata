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

import {
  Box,
  Paper,
  TableContainer,
  Typography,
  useTheme,
} from '@mui/material';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { useSnackbar } from 'notistack';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_MESSAGE } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { CreateDataProduct } from '../../generated/api/domains/createDataProduct';
import { CreateDomain } from '../../generated/api/domains/createDomain';
import { withPageLayout } from '../../hoc/withPageLayout';
import { addDataProducts } from '../../rest/dataProductAPI';
import { getIsErrorMatch } from '../../utils/CommonUtils';
import {
  showNotistackError,
  showNotistackSuccess,
} from '../../utils/NotistackUtils';
import { useDelete } from '../common/atoms/actions/useDelete';
import { useDataProductFilters } from '../common/atoms/domain/ui/useDataProductFilters';
import { useDomainCardTemplates } from '../common/atoms/domain/ui/useDomainCardTemplates';
import { useFormDrawerWithRef } from '../common/atoms/drawer';
import { useFilterSelection } from '../common/atoms/filters/useFilterSelection';
import { useBreadcrumbs } from '../common/atoms/navigation/useBreadcrumbs';
import { usePageHeader } from '../common/atoms/navigation/usePageHeader';
import { useSearch } from '../common/atoms/navigation/useSearch';
import { useTitleAndCount } from '../common/atoms/navigation/useTitleAndCount';
import { useViewToggle } from '../common/atoms/navigation/useViewToggle';
import { usePaginationControls } from '../common/atoms/pagination/usePaginationControls';
import { useCardView } from '../common/atoms/table/useCardView';
import { useDataTable } from '../common/atoms/table/useDataTable';
import AddDomainForm from '../Domain/AddDomainForm/AddDomainForm.component';
import { DomainFormType } from '../Domain/DomainPage.interface';
import { useDataProductListingData } from './hooks/useDataProductListingData';

const DataProductListPage = () => {
  const dataProductListing = useDataProductListingData();
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { permissions } = usePermissionProvider();
  const [form] = useForm();
  const [isLoading, setIsLoading] = useState(false);

  // Use the simplified data product filters configuration
  const { quickFilters, defaultFilters } = useDataProductFilters({
    aggregations: dataProductListing.aggregations || undefined,
    parsedFilters: dataProductListing.parsedFilters,
    onFilterChange: dataProductListing.handleFilterChange,
  });

  // Use the filter selection hook for displaying selected filters
  const { filterSelectionDisplay } = useFilterSelection({
    urlState: dataProductListing.urlState,
    filterConfigs: defaultFilters,
    parsedFilters: dataProductListing.parsedFilters,
    onFilterChange: dataProductListing.handleFilterChange,
  });

  const { formDrawer, openDrawer, closeDrawer } = useFormDrawerWithRef({
    title: t('label.add-entity', { entity: t('label.data-product') }),
    anchor: 'right',
    width: 670,
    closeOnEscape: false,
    onCancel: () => {
      form.resetFields();
    },
    form: (
      <AddDomainForm
        isFormInDialog
        formRef={form}
        loading={isLoading}
        type={DomainFormType.DATA_PRODUCT}
        onCancel={() => {
          // No-op: Drawer close and form reset handled by useFormDrawerWithRef
        }}
        onSubmit={async (formData: CreateDomain | CreateDataProduct) => {
          setIsLoading(true);
          try {
            await addDataProducts(formData as CreateDataProduct);
            showNotistackSuccess(
              enqueueSnackbar,
              <Typography sx={{ fontWeight: 600 }} variant="body2">
                {t('server.create-entity-success', {
                  entity: t('label.data-product'),
                })}
              </Typography>
            );
            // Close drawer only on successful creation
            closeDrawer();
            dataProductListing.refetch();
          } catch (error) {
            showNotistackError(
              enqueueSnackbar,
              getIsErrorMatch(
                error as AxiosError,
                ERROR_MESSAGE.alreadyExist
              ) ? (
                <Typography sx={{ fontWeight: 600 }} variant="body2">
                  {t('server.entity-already-exist', {
                    entity: t('label.data-product'),
                    entityPlural: 'data-products',
                    name: formData.name,
                  })}
                </Typography>
              ) : (
                (error as AxiosError)
              ),
              t('server.add-entity-error', {
                entity: t('label.data-product').toLowerCase(),
              }),
              { vertical: 'top', horizontal: 'center' }
            );

            // Keep drawer open on error so user can fix and retry
            throw error; // Re-throw to reject the promise
          } finally {
            setIsLoading(false);
          }
        }}
      />
    ),
    formRef: form,
    onSubmit: () => {
      // This is called by the drawer button, but actual submission
      // happens via formRef.submit() which triggers form.onFinish
    },
    loading: isLoading,
  });

  // Composable hooks for each UI component
  const { breadcrumbs } = useBreadcrumbs({
    entityLabelKey: 'label.data-product',
    basePath: '/dataProduct',
  });

  const { pageHeader } = usePageHeader({
    titleKey: 'label.data-product-plural',
    descriptionMessageKey: 'message.data-product-description',
    createPermission: permissions.dataProduct?.Create || false,
    addButtonLabelKey: 'label.add-data-product',
    onAddClick: openDrawer,
  });

  const { titleAndCount } = useTitleAndCount({
    titleKey: 'label.data-product',
    count: dataProductListing.totalEntities,
    loading: dataProductListing.loading,
  });

  const { search } = useSearch({
    searchPlaceholder: t('label.search'),
    onSearchChange: dataProductListing.handleSearchChange,
    initialSearchQuery: dataProductListing.urlState.searchQuery,
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

  // Map selected IDs to actual entities for the delete hook
  const selectedDataProductEntities = useMemo(
    () =>
      dataProductListing.entities.filter((entity) =>
        dataProductListing.selectedEntities.includes(entity.id)
      ),
    [dataProductListing.entities, dataProductListing.selectedEntities]
  );

  const { deleteIconButton, deleteModal } = useDelete({
    entityType: 'dataProducts',
    entityLabel: 'Data Product',
    selectedEntities: selectedDataProductEntities,
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
            flexDirection: 'column',
            gap: 4,
            px: 6,
            py: 4,
            borderBottom: `1px solid`,
            borderColor: theme.palette.allShades?.gray?.[200],
          }}>
          <Box sx={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {titleAndCount}
            {search}
            {quickFilters}
            <Box ml="auto" />
            {viewToggle}
            {deleteIconButton}
          </Box>
          {filterSelectionDisplay}
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
