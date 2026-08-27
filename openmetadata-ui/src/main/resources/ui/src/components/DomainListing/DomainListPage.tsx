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
  EmptyPlaceholder,
  Input,
  PaginationCardDefault,
} from '@openmetadata/ui-core-components';
import { SearchIndex } from '@openmetadata/ui-core-components/icons';
import { Globe01, Plus } from '@untitledui/icons';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { useIsAiMode } from '../../hooks/useAppMode';
import { useMarketplaceStore } from '../../hooks/useMarketplaceStore';
import { useDelete } from '../common/atoms/actions/useDelete';
import { useDomainCardTemplates } from '../common/atoms/domain/ui/useDomainCardTemplates';
import { useDomainFilters } from '../common/atoms/domain/ui/useDomainFilters';
import { useDomainTableColumns } from '../common/atoms/domain/ui/useDomainTableColumns';
import { useFilterSelection } from '../common/atoms/filters/useFilterSelection';
import { useListSearchInput } from '../common/atoms/navigation/useListSearchInput';
import { usePageHeader } from '../common/atoms/navigation/usePageHeader';
import { useTitleAndCount } from '../common/atoms/navigation/useTitleAndCount';
import { hasActiveSearchOrFilter } from '../common/atoms/shared/utils/hasActiveSearchOrFilter';
import EntityCardView from '../common/EntityCardView/EntityCardView.component';
import EntityListingTable from '../common/EntityListingTable/EntityListingTable.component';
import HeaderBreadcrumb from '../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import ViewToggle, { ViewMode } from '../common/ViewToggle/ViewToggle';
import PageLayoutV1 from '../PageLayoutV1/PageLayoutV1';
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

  const showHeaderSearch = isAiMode;

  const { searchInputProps } = useListSearchInput({
    searchQuery: domainListing.urlState.searchQuery,
    onSearchChange: domainListing.handleSearchChange,
  });

  const headerSearch = showHeaderSearch ? (
    <Input className="tw:w-72" {...searchInputProps} />
  ) : undefined;

  const { pageHeader } = usePageHeader({
    titleKey: 'label.domain-plural',
    descriptionMessageKey: 'message.domain-description',
    createPermission: permissions.domain?.Create || false,
    addButtonLabelKey: 'label.add-domain',
    addButtonTestId: 'add-domain',
    onAddClick: openDrawer,
    learningPageId: LEARNING_PAGE_IDS.DOMAIN,
    variant: isAiMode ? 'search' : undefined,
    search: headerSearch,
    breadcrumb: headerBreadcrumb,
  });

  const { titleAndCount } = useTitleAndCount({
    titleKey: 'label.domain',
    count: domainListing.totalEntities,
    loading: domainListing.loading,
  });

  const [view, setView] = useState<ViewMode>(ViewMode.Table);
  const isTreeView = view === ViewMode.Tree;
  const { renderDomainCard } = useDomainCardTemplates();

  const { columns: domainColumns, renderCell: renderDomainCell } =
    useDomainTableColumns({
      onEntityClick: domainListing.actionHandlers.onEntityClick,
    });

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
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-6 tw:pb-6">
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
          <div className="tw:relative tw:min-h-70">
            <EmptyPlaceholder
              actions={[{
                color: 'primary',
                key: 'clear-filters',
                label: t('label.clear-filter-plural'),
                onPress: () => {
                  domainListing.handleSearchChange('');
                  domainListing.handleFilterChange([]);
                },
              }]}
              description={t('message.nothing-matches-current-filter')}
              icon={<SearchIndex className="tw:text-secondary" />}
              title={t('label.no-result-for-these-filter-plural')}
            />
          </div>
        );
      }

      return (
        <div className="tw:relative tw:min-h-70">
          <EmptyPlaceholder
            actions={
              permissions.domain?.Create
                ? [
                    {
                      color: 'primary',
                      iconLeading: Plus,
                      key: 'add-domain',
                      label: t('label.add-entity', {
                        entity: t('label.domain'),
                      }),
                      onPress: openDrawer,
                    },
                  ]
                : undefined
            }
            description={t('label.no-domains-yet-description')}
            icon={<Globe01 className="tw:text-fg-brand-primary" />}
            title={t('label.no-domains-yet')}
            variant="blank"
          />
        </div>
      );
    }

    if (view === ViewMode.Table) {
      return (
        <>
          <EntityListingTable
            ariaLabel={t('label.domain')}
            columns={domainColumns}
            containerClassName="tw:min-h-0 tw:flex-1 tw:overflow-y-auto"
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
          className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:grid-cols-[repeat(auto-fill,minmax(380px,1fr))]"
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
    domainListing.handleSearchChange,
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
      className={classNames('tw:min-h-0 tw:flex-1', {
        'tw:h-[var(--om-page-height)]': isTreeView && !isAiMode,
      })}
      direction="col">
      {!renderPageHeader && !isAiMode && (
        <HeaderBreadcrumb items={breadcrumbItems} />
      )}
      {renderPageHeader
        ? renderPageHeader({
            onAddClick: openDrawer,
            createPermission: permissions.domain?.Create || false,
            count: domainListing.totalEntities,
            breadcrumb: headerBreadcrumb,
            search: headerSearch,
          })
        : pageHeader}

      <Card
        className={classNames('tw:flex tw:min-h-0 tw:flex-1 tw:flex-col', {
          'tw:mb-5': !isAiMode,
        })}
        variant={isAiMode ? 'default' : 'elevated'}>
        <Box
          className="tw:px-6 tw:py-4 tw:border-b tw:border-secondary"
          direction="col"
          gap={4}>
          <Box align="center" direction="row" gap={5}>
            {!showHeaderSearch && titleAndCount}
            {!showHeaderSearch && (
              <Input className="tw:max-w-86" {...searchInputProps} />
            )}
            {quickFilters}
            <Box className="tw:ml-auto" />
            <ViewToggle
              value={view}
              views={[ViewMode.Table, ViewMode.Card, ViewMode.Tree]}
              onChange={setView}
            />
            {deleteIconButton}
          </Box>
          {filterSelectionDisplay}
        </Box>
        {content}
      </Card>
      {deleteModal}
      {formDrawer}
    </Box>
  );
};

const DomainListPageWithLayout: FC<DomainListPageProps> = (props) => {
  const isAiMode = useIsAiMode();

  return (
    <PageLayoutV1
      className={isAiMode ? 'tw:h-auto!' : undefined}
      fullHeight={isAiMode}
      pageTitle={props.pageTitle}
      variant={isAiMode ? 'compact' : 'default'}>
      <DomainListPage {...props} />
    </PageLayoutV1>
  );
};

export { DomainListPage };

export default DomainListPageWithLayout;