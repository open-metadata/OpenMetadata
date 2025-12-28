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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderEmptyIcon } from '../../assets/svg/folder-empty.svg';
import { DRAWER_HEADER_STYLING } from '../../constants/DomainsListPage.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { CreateDataProduct } from '../../generated/api/domains/createDataProduct';
import { CreateDomain } from '../../generated/api/domains/createDomain';
import { withPageLayout } from '../../hoc/withPageLayout';
import { addDomains, patchDomains } from '../../rest/domainAPI';
import { createEntityWithCoverImage } from '../../utils/CoverImageUploadUtils';
import { useDelete } from '../common/atoms/actions/useDelete';
import { useDomainCardTemplates } from '../common/atoms/domain/ui/useDomainCardTemplates';
import { useDomainFilters } from '../common/atoms/domain/ui/useDomainFilters';
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
import DomainTreeView from './components/DomainTreeView';
import { useDomainListingData } from './hooks/useDomainListingData';

const DomainListPage = () => {
  const domainListing = useDomainListingData();
  const theme = useTheme();
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const [form] = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [treeRefreshToken, setTreeRefreshToken] = useState(0);

  // Use the simplified domain filters configuration
  const { quickFilters, defaultFilters } = useDomainFilters({
    aggregations: domainListing.aggregations || undefined,
    parsedFilters: domainListing.parsedFilters,
    onFilterChange: domainListing.handleFilterChange,
  });

  // Use the filter selection hook for displaying selected filters
  const { filterSelectionDisplay } = useFilterSelection({
    urlState: domainListing.urlState,
    filterConfigs: defaultFilters,
    parsedFilters: domainListing.parsedFilters,
    onFilterChange: domainListing.handleFilterChange,
  });

  const { formDrawer, openDrawer, closeDrawer } = useFormDrawerWithRef({
    title: t('label.add-entity', { entity: t('label.domain') }),
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
        type={DomainFormType.DOMAIN}
        onCancel={() => {
          // No-op: Drawer close and form reset handled by useFormDrawerWithRef
        }}
        onSubmit={async (formData: CreateDomain | CreateDataProduct) => {
          setIsLoading(true);
          try {
            await createEntityWithCoverImage({
              formData: formData as CreateDomain,
              entityType: EntityType.DOMAIN,
              entityLabel: t('label.domain'),
              entityPluralLabel: 'domains',
              createEntity: addDomains,
              patchEntity: patchDomains,
              onSuccess: () => {
                closeDrawer();
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                refreshAllDomains();
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
    items: [{ name: t('label.domain-plural'), url: '/domain' }],
  });

  const { pageHeader } = usePageHeader({
    titleKey: 'label.domain-plural',
    descriptionMessageKey: 'message.domain-description',
    createPermission: permissions.domain?.Create || false,
    addButtonLabelKey: 'label.add-domain',
    addButtonTestId: 'add-domain',
    onAddClick: openDrawer,
    learningPageId: 'domain',
  });

  const { titleAndCount } = useTitleAndCount({
    titleKey: 'label.domain',
    count: domainListing.totalEntities,
    loading: domainListing.loading,
  });

  const { search } = useSearch({
    searchPlaceholder: t('label.search'),
    onSearchChange: domainListing.handleSearchChange,
    initialSearchQuery: domainListing.urlState.searchQuery,
  });

  const { view, viewToggle, isTreeView } = useViewToggle({
    views: ['table', 'card', 'tree'],
  });
  const { domainCardTemplate } = useDomainCardTemplates();

  useEffect(() => {
    if (isTreeView && !isEmpty(domainListing.urlState.filters)) {
      domainListing.handleFilterChange([]);
    }
  }, [isTreeView]);

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

  const { refetch: refetchDomainListing } = domainListing;

  const refreshAllDomains = useCallback(() => {
    refetchDomainListing();
    setTreeRefreshToken((prev) => prev + 1);
  }, [refetchDomainListing]);

  // Map selected IDs to actual entities for the delete hook
  const selectedDomainEntities = useMemo(
    () =>
      domainListing.entities.filter((entity) =>
        domainListing.selectedEntities.includes(entity.id)
      ),
    [domainListing.entities, domainListing.selectedEntities]
  );

  const { deleteIconButton, deleteModal } = useDelete({
    entityType: 'domains',
    entityLabel: 'Domain',
    selectedEntities: selectedDomainEntities,
    onDeleteComplete: () => {
      domainListing.clearSelection();
      refreshAllDomains();
    },
  });

  const content = useMemo(() => {
    if (isTreeView) {
      return (
        <Box sx={{ px: 6, pb: 6 }}>
          <DomainTreeView
            filters={domainListing.urlState.filters}
            openAddDomainDrawer={openDrawer}
            refreshToken={treeRefreshToken}
            searchQuery={domainListing.urlState.searchQuery}
          />
        </Box>
      );
    }

    if (!domainListing.loading && isEmpty(domainListing.entities)) {
      return (
        <ErrorPlaceHolder
          buttonId="domain-add-button"
          buttonTitle={t('label.add-entity', {
            entity: t('label.domain'),
          })}
          className="border-none"
          heading={t('message.no-data-message', {
            entity: t('label.domain-lowercase-plural'),
          })}
          icon={<FolderEmptyIcon />}
          permission={permissions.domain?.Create}
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
    isTreeView,
    domainListing.loading,
    domainListing.entities,
    domainListing.urlState.filters,
    domainListing.urlState.searchQuery,
    view,
    dataTable,
    cardView,
    paginationControls,
    treeRefreshToken,
    openDrawer,
    refreshAllDomains,
    t,
    permissions.domain?.Create,
  ]);

  return (
    <Box
      sx={
        isTreeView
          ? {
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 80px)',
            }
          : {}
      }>
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
            {!isTreeView && quickFilters}
            <Box ml="auto" />
            {viewToggle}
            {deleteIconButton}
          </Box>
          {!isTreeView && filterSelectionDisplay}
        </Box>
        {content}
      </TableContainer>
      {deleteModal}
      {formDrawer}
    </Box>
  );
};

export default withPageLayout(DomainListPage);
