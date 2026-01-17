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
import { isEmpty } from 'lodash';
import { useSnackbar } from 'notistack';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderEmptyIcon } from '../../assets/svg/folder-empty.svg';
import { DRAWER_HEADER_STYLING } from '../../constants/DomainsListPage.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { CreateDataProduct } from '../../generated/api/domains/createDataProduct';
import { CreateDomain } from '../../generated/api/domains/createDomain';
import { withPageLayout } from '../../hoc/withPageLayout';
import { addDataProducts, patchDataProduct } from '../../rest/dataProductAPI';
import { createEntityWithCoverImage } from '../../utils/CoverImageUploadUtils';
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
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import AddDomainForm from '../Domain/AddDomainForm/AddDomainForm.component';
import { DomainFormType } from '../Domain/DomainPage.interface';
import { useDataProductListingData } from './hooks/useDataProductListingData';

const DataProductListPage = () => {
  const dataProductListing = useDataProductListingData();
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
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
    header: {
      sx: DRAWER_HEADER_STYLING,
    },
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
            await createEntityWithCoverImage({
              formData: formData as CreateDataProduct,
              entityType: EntityType.DATA_PRODUCT,
              entityLabel: t('label.data-product'),
              entityPluralLabel: 'data-products',
              createEntity: addDataProducts,
              patchEntity: patchDataProduct,
              onSuccess: () => {
                closeDrawer();
                dataProductListing.refetch();
              },
              enqueueSnackbar,
              closeSnackbar,
              t,
            });
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
    items: [{ name: t('label.data-product-plural'), url: '/dataProduct' }],
  });

  const { pageHeader } = usePageHeader({
    titleKey: 'label.data-product-plural',
    descriptionMessageKey: 'message.data-product-description',
    createPermission: permissions.dataProduct?.Create || false,
    addButtonLabelKey: 'label.add-data-product',
    onAddClick: openDrawer,
    learningPageId: 'dataProduct',
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

  const hasActiveSearchOrFilter = useCallback(() => {
    const { searchQuery, filters } = dataProductListing.urlState;

    const hasActiveFilters =
      filters &&
      Object.values(filters).some(
        (values) => Array.isArray(values) && values.length > 0
      );

    return Boolean(searchQuery) || hasActiveFilters;
  }, [dataProductListing.urlState]);

  const content = useMemo(() => {
    if (!dataProductListing.loading && isEmpty(dataProductListing.entities)) {
      if (hasActiveSearchOrFilter()) {
        return (
          <ErrorPlaceHolder
            className="border-none"
            type={ERROR_PLACEHOLDER_TYPE.FILTER}
          />
        );
      }

      return (
        <ErrorPlaceHolder
          buttonId="data-product-add-button"
          buttonTitle={t('label.add-entity', {
            entity: t('label.data-product'),
          })}
          className="border-none"
          heading={t('message.no-data-message', {
            entity: t('label.data-product-lowercase-plural'),
          })}
          icon={<FolderEmptyIcon />}
          permission={permissions.dataProduct?.Create}
          type={ERROR_PLACEHOLDER_TYPE.MUI_CREATE}
          onClick={openDrawer}
        />
      );
    }

    if (view === 'table') {
      return (
        <>
          {dataTable}
          {paginationControls}
        </>
      );
    }

    return (
      <>
        {cardView}
        {paginationControls}
      </>
    );
  }, [
    dataProductListing.loading,
    dataProductListing.entities,
    hasActiveSearchOrFilter,
    view,
    dataTable,
    cardView,
    paginationControls,
    openDrawer,
    t,
    permissions.dataProduct?.Create,
  ]);

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
        {content}
      </TableContainer>
      {deleteModal}
      {formDrawer}
    </>
  );
};

export default withPageLayout(DataProductListPage);
