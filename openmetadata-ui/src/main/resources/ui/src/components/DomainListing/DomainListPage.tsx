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
  Card,
  Input,
  PaginationCardDefault,
} from '@openmetadata/ui-core-components';
import { SearchLg } from '@untitledui/icons';
import { debounce, isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderEmptyIcon } from '../../assets/svg/folder-empty.svg';
import { ROUTES } from '../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useIsAiMode } from '../../hooks/useAppMode';
import { useMarketplaceStore } from '../../hooks/useMarketplaceStore';
import { useDelete } from '../common/atoms/actions/useDelete';
import { useDomainCardTemplates } from '../common/atoms/domain/ui/useDomainCardTemplates';
import { useDomainFilters } from '../common/atoms/domain/ui/useDomainFilters';
import { useDomainTableColumns } from '../common/atoms/domain/ui/useDomainTableColumns';
import { useFilterSelection } from '../common/atoms/filters/useFilterSelection';
import { usePageHeader } from '../common/atoms/navigation/usePageHeader';
import { useTitleAndCount } from '../common/atoms/navigation/useTitleAndCount';
import { hasActiveSearchOrFilter } from '../common/atoms/shared/utils/hasActiveSearchOrFilter';
import EntityCardView from '../common/EntityCardView/EntityCardView.component';
import EntityListingTable from '../common/EntityListingTable/EntityListingTable.component';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import HeaderBreadcrumb from '../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import ViewToggle, { ViewMode } from '../common/ViewToggle/ViewToggle';
import DomainTreeView from './components/DomainTreeView';
import { DomainListPageProps } from './DomainListPage.interface';
import { useDomainCreateDrawer } from './hooks/useDomainCreateDrawer';
import { useDomainListingData } from './hooks/useDomainListingData';

const DomainListPage = ({ renderPageHeader }: DomainListPageProps) => {
  const domainListing = useDomainListingData();
  const { isMarketplace, domainBasePath } = useMarketplaceStore();
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const { permissions } = usePermissionProvider();
  const [treeRefreshToken, setTreeRefreshToken] = useState(0);

  const { quickFilters, defaultFilters } = useDomainFilters({
    aggregations: domainListing.aggregations || undefined,
    parsedFilters: domainListing.parsedFilters,
    onFilterChange: domainListing.handleFilterChange,
  });

  const { filterSelectionDisplay } = useFilterSelection({
    urlState: domainListing.urlState,
    filterConfigs: defaultFilters,
    parsedFilters: domainListing.parsedFilters,
    onFilterChange: domainListing.handleFilterChange,
  });

  const { refetch: refetchDomainListing } = domainListing;

  const refreshAllDomains = useCallback(() => {
    refetchDomainListing();
    setTreeRefreshToken((prev) => prev + 1);
  }, [refetchDomainListing]);

  const { formDrawer, openDrawer } = useDomainCreateDrawer(refreshAllDomains);

  const breadcrumbItems = useMemo(
    () => [
      ...(isMarketplace
        ? [
            {
              label: t('label.data-marketplace'),
              href: ROUTES.DATA_MARKETPLACE,
            },
          ]
        : []),
      { label: t('label.domain-plural'), href: domainBasePath },
    ],
    [domainBasePath, isMarketplace, t]
  );

  const headerBreadcrumb = (
    <HeaderBreadcrumb noMargin items={breadcrumbItems} />
  );

  const { pageHeader } = usePageHeader({
    titleKey: 'label.domain-plural',
    descriptionMessageKey: 'message.domain-description',
    createPermission: permissions.domain?.Create || false,
    addButtonLabelKey: 'label.add-domain',
    addButtonTestId: 'add-domain',
    onAddClick: openDrawer,
    learningPageId: LEARNING_PAGE_IDS.DOMAIN,
    variant: isAiMode ? 'search' : undefined,
    breadcrumb: headerBreadcrumb,
  });

  const { titleAndCount } = useTitleAndCount({
    titleKey: 'label.domain',
    count: domainListing.totalEntities,
    loading: domainListing.loading,
  });

  const [searchInputValue, setSearchInputValue] = useState(
    domainListing.urlState.searchQuery ?? ''
  );

  const debouncedSearch = useMemo(
    () => debounce(domainListing.handleSearchChange, 300),
    [domainListing.handleSearchChange]
  );

  useEffect(() => {
    debouncedSearch.cancel();
    setSearchInputValue(domainListing.urlState.searchQuery ?? '');
  }, [domainListing.urlState.searchQuery, debouncedSearch]);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const [view, setView] = useState<ViewMode>(ViewMode.Table);
  const isTreeView = view === ViewMode.Tree;
  const { renderDomainCard } = useDomainCardTemplates();

  useEffect(() => {
    if (isTreeView && !isEmpty(domainListing.urlState.filters)) {
      domainListing.handleFilterChange([]);
    }
  }, [isTreeView]);

  const { columns: domainColumns, renderCell: renderDomainCell } =
    useDomainTableColumns();

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

  const isSearchOrFilterActive = useCallback(
    () => hasActiveSearchOrFilter(domainListing.urlState),
    [domainListing.urlState]
  );

  const content = useMemo(() => {
    if (isTreeView) {
      return (
        <div className="tw:px-6 tw:pb-6">
          <DomainTreeView
            filters={domainListing.urlState.filters}
            openAddDomainDrawer={openDrawer}
            refreshToken={treeRefreshToken}
            searchQuery={domainListing.urlState.searchQuery}
          />
        </div>
      );
    }

    if (!domainListing.loading && isEmpty(domainListing.entities)) {
      if (isSearchOrFilterActive()) {
        return (
          <ErrorPlaceHolder
            className="border-none"
            type={ERROR_PLACEHOLDER_TYPE.FILTER}
          />
        );
      }

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
          type={ERROR_PLACEHOLDER_TYPE.CORE_CREATE}
          onClick={openDrawer}
        />
      );
    }

    if (view === ViewMode.Table) {
      return (
        <>
          <EntityListingTable
            ariaLabel={t('label.domain')}
            columns={domainColumns}
            entities={domainListing.entities}
            loading={domainListing.loading}
            renderCell={renderDomainCell}
            selectedEntities={domainListing.selectedEntities}
            onEntityClick={domainListing.actionHandlers.onEntityClick}
            onSelect={domainListing.handleSelect}
            onSelectAll={domainListing.handleSelectAll}
          />
          <PaginationCardDefault
            page={domainListing.currentPage}
            total={domainListing.totalPages}
            onPageChange={domainListing.handlePageChange}
          />
        </>
      );
    }

    return (
      <>
        <EntityCardView
          className="tw:grid-cols-[repeat(auto-fill,minmax(380px,1fr))]"
          entities={domainListing.entities}
          loading={domainListing.loading}
          renderCard={renderDomainCard}
          onEntityClick={domainListing.actionHandlers.onEntityClick}
        />
        <PaginationCardDefault
          page={domainListing.currentPage}
          total={domainListing.totalPages}
          onPageChange={domainListing.handlePageChange}
        />
      </>
    );
  }, [
    isTreeView,
    domainListing.loading,
    domainListing.entities,
    domainListing.selectedEntities,
    domainListing.actionHandlers,
    domainListing.urlState.filters,
    domainListing.urlState.searchQuery,
    domainListing.currentPage,
    domainListing.totalPages,
    domainListing.handlePageChange,
    isSearchOrFilterActive,
    view,
    renderDomainCell,
    renderDomainCard,
    treeRefreshToken,
    openDrawer,
    refreshAllDomains,
    t,
    permissions.domain?.Create,
  ]);

  return (
    <Box
      direction="col"
      style={isTreeView ? { height: 'calc(100vh - 80px)' } : {}}>
      {!renderPageHeader && !isAiMode && (
        <HeaderBreadcrumb items={breadcrumbItems} />
      )}
      {renderPageHeader
        ? renderPageHeader({
            onAddClick: openDrawer,
            createPermission: permissions.domain?.Create || false,
            count: domainListing.totalEntities,
            breadcrumb: headerBreadcrumb,
          })
        : pageHeader}

      <Card style={{ marginBottom: 20 }} variant="elevated">
        <Box
          className="tw:px-6 tw:py-4 tw:border-b tw:border-secondary"
          direction="col"
          gap={4}>
          <Box align="center" direction="row" gap={5}>
            {titleAndCount}
            <Input
              className="tw:max-w-86"
              icon={SearchLg}
              placeholder={t('label.search')}
              value={searchInputValue}
              onChange={(value) => {
                setSearchInputValue(value);
                debouncedSearch(value);
              }}
            />
            {!isTreeView && quickFilters}
            <Box className="tw:ml-auto" />
            <ViewToggle
              value={view}
              views={[ViewMode.Table, ViewMode.Card, ViewMode.Tree]}
              onChange={setView}
            />
            {deleteIconButton}
          </Box>
          {!isTreeView && filterSelectionDisplay}
        </Box>
        {content}
      </Card>
      {deleteModal}
      {formDrawer}
    </Box>
  );
};

export { DomainListPage };

export default withPageLayout(DomainListPage);
