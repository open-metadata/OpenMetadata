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
import { withPageLayout } from '../../hoc/withPageLayout';
import { addDomains } from '../../rest/domainAPI';
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
import { DOMAIN_FILTER_CONFIGS } from '../common/atoms/shared/utils/commonFilterConfigs';
import { useCardView } from '../common/atoms/table/useCardView';
import { useDataTable } from '../common/atoms/table/useDataTable';
import AddDomainForm from '../Domain/AddDomainForm/AddDomainForm.component';
import { DomainFormType } from '../Domain/DomainPage.interface';
import { useDomainListingData } from './hooks/useDomainListingData';

const DomainListPage = () => {
  const domainListing = useDomainListingData();
  const theme = useTheme();
  const { t } = useTranslation();
  const [form] = useForm();
  const [isLoading, setIsLoading] = useState(false);

  const { formDrawer, openDrawer, closeDrawer } = useFormDrawerWithRef({
    title: t('label.add-entity', { entity: t('label.domain') }),
    anchor: 'right',
    width: 750,
    closeOnEscape: false,
    form: (
      <AddDomainForm
        isFormInDialog
        formRef={form}
        loading={isLoading}
        type={DomainFormType.DOMAIN}
        onCancel={() => {
          // No-op: Drawer close is handled by useFormDrawerWithRef
        }}
        onSubmit={async (formData: any) => {
          setIsLoading(true);
          try {
            await addDomains(formData);
            showSuccessToast(
              t('server.create-entity-success', {
                entity: t('label.domain'),
              })
            );
            // Close drawer only on successful creation
            closeDrawer();
            domainListing.refetch();
          } catch (error) {
            showErrorToast(
              getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
                ? t('server.entity-already-exist', {
                    entity: t('label.domain'),
                    entityPlural: 'domains',
                    name: formData.name,
                  })
                : (error as AxiosError),
              t('server.add-entity-error', {
                entity: t('label.domain').toLowerCase(),
              })
            );
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

  const { dropdownConfigs } = useFilterConfig({
    filterConfigs: DOMAIN_FILTER_CONFIGS,
    filterOptions: domainListing.filterOptions || {},
    selectedFilters: domainListing.urlState.filters,
    onFilterChange: domainListing.handleFilterChange,
    onFilterSearch: domainListing.searchFilterOptions,
  });

  // Composable hooks for each UI component
  const { breadcrumbs } = useBreadcrumbs({
    entityLabelKey: 'label.domain',
    basePath: '/domain',
  });

  const { pageHeader } = usePageHeader({
    titleKey: 'label.domain',
    descriptionMessageKey: 'message.domain-description',
    createPermission: true,
    addButtonLabelKey: 'label.add-domain',
    onAddClick: openDrawer,
  });

  const { titleAndCount } = useTitleAndCount({
    titleKey: 'label.domain',
    count: domainListing.totalEntities,
    loading: domainListing.loading,
  });

  const { search } = useSearch({
    searchPlaceholderKey: 'label.search',
    onSearchChange: domainListing.handleSearchChange,
    initialSearchQuery: domainListing.urlState.searchQuery,
  });

  const { filterDropdowns } = useFilterDropdowns({
    filters: dropdownConfigs,
  });

  const { view, viewToggle } = useViewToggle();
  const { domainCardTemplate } = useDomainCardTemplates();

  const { dataTable } = useDataTable({
    listing: domainListing,
    enableSelection: true,
    entityLabelKey: 'label.domain',
  });

  const { cardView } = useCardView({
    listing: domainListing,
    cardTemplate: domainCardTemplate,
  });

  const { paginationControls } = usePaginationControls({
    currentPage: domainListing.currentPage,
    totalPages: domainListing.totalPages,
    totalEntities: domainListing.totalEntities,
    pageSize: domainListing.pageSize,
    onPageChange: domainListing.handlePageChange,
    loading: domainListing.loading,
  });

  const { deleteIconButton, deleteModal } = useDelete({
    entityType: 'domains',
    entityLabel: 'Domain',
    selectedEntities: domainListing.selectedEntities,
    onDeleteComplete: () => {
      domainListing.clearSelection();
      domainListing.refetch();
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

export default withPageLayout(DomainListPage);
