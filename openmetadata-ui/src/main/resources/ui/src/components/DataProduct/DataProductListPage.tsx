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
  Avatar,
  Box,
  Card,
  EmptyPlaceholder,
  Input,
  PaginationCardDefault,
  Typography,
} from '@openmetadata/ui-core-components';
import { SearchIndex } from '@openmetadata/ui-core-components/icons';
import { Globe01, Package, Plus } from '@untitledui/icons';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import {
  FC,
  MouseEvent,
  ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA, ROUTES } from '../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { DataProduct } from '../../generated/entity/domains/dataProduct';
import { useIsAiMode } from '../../hooks/useAppMode';
import { useMarketplaceStore } from '../../hooks/useMarketplaceStore';
import { getEntityName } from '../../utils/EntityNameUtils';
import { getEntityAvatarProps } from '../../utils/IconUtils';
import {
  getClassificationTags,
  getGlossaryTags,
} from '../../utils/TagsPureUtils';
import { renderBreakableTooltip } from '../../utils/TooltipUtils';
import { useDelete } from '../common/atoms/actions/useDelete';
import {
  CLIPPED_NAME_CLASS,
  COMPACT_CELL_CLIP_CLASS,
  NAME_CELL_CLIP_CLASS,
} from '../common/atoms/domain/ui/domainFieldRenderers';
import { useDataProductFilters } from '../common/atoms/domain/ui/useDataProductFilters';
import { useDomainCardTemplates } from '../common/atoms/domain/ui/useDomainCardTemplates';
import { useFilterSelection } from '../common/atoms/filters/useFilterSelection';
import { useListSearchInput } from '../common/atoms/navigation/useListSearchInput';
import { usePageHeader } from '../common/atoms/navigation/usePageHeader';
import { useTitleAndCount } from '../common/atoms/navigation/useTitleAndCount';
import { hasActiveSearchOrFilter } from '../common/atoms/shared/utils/hasActiveSearchOrFilter';
import EntityCardView from '../common/EntityCardView/EntityCardView.component';
import EntityListingTable from '../common/EntityListingTable/EntityListingTable.component';
import { ColumnDef } from '../common/EntityListingTable/EntityListingTable.interface';
import HeaderBreadcrumb from '../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { OwnerLabel } from '../common/OwnerLabel/OwnerLabel.component';
import TagBadgeList from '../common/TagBadgeList/TagBadgeList.component';
import ViewToggle, { ViewMode } from '../common/ViewToggle/ViewToggle';
import PageLayoutV1 from '../PageLayoutV1/PageLayoutV1';
import { DataProductListPageProps } from './DataProductListPage.interface';
import { useDataProductCreateDrawer } from './hooks/useDataProductCreateDrawer';
import { useDataProductListingData } from './hooks/useDataProductListingData';

const DataProductListPage = ({
  renderPageHeader,
}: DataProductListPageProps) => {
  const dataProductListing = useDataProductListingData();
  const { isMarketplace, dataProductBasePath } = useMarketplaceStore();
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const { permissions } = usePermissionProvider();
  const { quickFilters, defaultFilters } = useDataProductFilters({
    aggregations: dataProductListing.aggregations || undefined,
    parsedFilters: dataProductListing.parsedFilters,
    onFilterChange: dataProductListing.handleFilterChange,
  });

  const { filterSelectionDisplay } = useFilterSelection({
    urlState: dataProductListing.urlState,
    filterConfigs: defaultFilters,
    parsedFilters: dataProductListing.parsedFilters,
    onFilterChange: dataProductListing.handleFilterChange,
  });

  const refreshDataProducts = useCallback(() => {
    dataProductListing.refetch();
  }, [dataProductListing]);

  const { formDrawer, openDrawer } =
    useDataProductCreateDrawer(refreshDataProducts);

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
      {
        label: t('label.data-product-plural'),
        href: dataProductBasePath,
      },
    ],
    [dataProductBasePath, isMarketplace, t]
  );

  const headerBreadcrumb = (
    <HeaderBreadcrumb noMargin items={breadcrumbItems} />
  );

  const showHeaderSearch = isAiMode;

  const { searchInputProps } = useListSearchInput({
    searchQuery: dataProductListing.urlState.searchQuery,
    onSearchChange: dataProductListing.handleSearchChange,
  });

  const headerSearch = showHeaderSearch ? (
    <Input className="tw:w-72" {...searchInputProps} />
  ) : undefined;

  const { pageHeader } = usePageHeader({
    titleKey: 'label.data-product-plural',
    descriptionMessageKey: 'message.data-product-description',
    createPermission: permissions.dataProduct?.Create || false,
    addButtonLabelKey: 'label.add-data-product',
    onAddClick: openDrawer,
    learningPageId: LEARNING_PAGE_IDS.DATA_PRODUCT,
    variant: isAiMode ? 'search' : undefined,
    search: headerSearch,
    breadcrumb: headerBreadcrumb,
  });

  const { titleAndCount } = useTitleAndCount({
    titleKey: 'label.data-product',
    count: dataProductListing.totalEntities,
    loading: dataProductListing.loading,
  });

  const [view, setView] = useState<ViewMode>(ViewMode.Table);
  const { renderDataProductCard } = useDomainCardTemplates();

  const dataProductColumns: ColumnDef[] = useMemo(
    () => [
      { id: 'name', label: t('label.data-product') },
      { id: 'owners', label: t('label.owner') },
      { id: 'glossaryTerms', label: t('label.glossary-term-plural') },
      { id: 'domains', label: t('label.domain-plural') },
      { id: 'tags', label: t('label.tag-plural') },
      { id: 'experts', label: t('label.expert-plural') },
    ],
    [t]
  );

  const renderDataProductCell = useCallback(
    (entity: DataProduct, columnId: string): ReactNode => {
      switch (columnId) {
        case 'name': {
          const entityName = getEntityName(entity);
          const showName =
            entity.displayName &&
            entity.name &&
            entity.displayName !== entity.name;

          const handleNameClick = (event: MouseEvent<HTMLDivElement>) => {
            event.stopPropagation();
            dataProductListing.actionHandlers.onEntityClick?.(entity);
          };

          return (
            <Box
              align="center"
              className={NAME_CELL_CLIP_CLASS}
              direction="row"
              gap={3}
              onClick={handleNameClick}>
              <Avatar size="md" {...getEntityAvatarProps(entity)} />
              <Box className="tw:min-w-0" direction="col">
                <Typography
                  className={CLIPPED_NAME_CLASS}
                  ellipsis={{ tooltip: renderBreakableTooltip(entityName) }}
                  size="text-sm"
                  weight="medium">
                  {entityName}
                </Typography>
                {showName && (
                  <Typography
                    className={CLIPPED_NAME_CLASS}
                    ellipsis={{ tooltip: renderBreakableTooltip(entity.name) }}
                    size="text-xs">
                    {entity.name}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        }
        case 'owners':
          return (
            <OwnerLabel
              isCompactView={false}
              maxVisibleOwners={4}
              owners={entity.owners}
              showLabel={false}
            />
          );
        case 'glossaryTerms':
          return <TagBadgeList size="lg" tags={getGlossaryTags(entity.tags)} />;
        case 'domains': {
          const domains = entity.domains;
          if (!domains?.length) {
            return <Typography size="text-sm">{NO_DATA}</Typography>;
          }
          const domain = domains[0];

          return (
            <Box
              align="center"
              className={COMPACT_CELL_CLIP_CLASS}
              direction="row"
              gap={1}>
              <Globe01 size={16} style={{ flexShrink: 0 }} />
              <Typography
                className={CLIPPED_NAME_CLASS}
                ellipsis={{
                  tooltip: renderBreakableTooltip(
                    domain.displayName || domain.name
                  ),
                }}
                size="text-sm">
                {domain.displayName || domain.name}
              </Typography>
            </Box>
          );
        }
        case 'tags':
          return (
            <TagBadgeList size="sm" tags={getClassificationTags(entity.tags)} />
          );
        case 'experts':
          return (
            <OwnerLabel
              isCompactView={false}
              maxVisibleOwners={4}
              owners={entity.experts}
              showLabel={false}
            />
          );
        default:
          return null;
      }
    },
    [dataProductListing.actionHandlers.onEntityClick]
  );

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

  const isSearchOrFilterActive = useCallback(
    () => hasActiveSearchOrFilter(dataProductListing.urlState),
    [dataProductListing.urlState]
  );

  const content = useMemo(() => {
    if (!dataProductListing.loading && isEmpty(dataProductListing.entities)) {
      if (isSearchOrFilterActive()) {
        return (
          <div className="tw:relative tw:min-h-70">
            <EmptyPlaceholder
              actions={[{
                color: 'primary',
                key: 'clear-filters',
                label: t('label.clear-filter-plural'),
                onPress: () => {
                  dataProductListing.handleSearchChange('');
                  dataProductListing.handleFilterChange([]);
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
        <div
          className="tw:relative tw:min-h-70"
          data-testid="no-data-placeholder">
          <EmptyPlaceholder
            actions={
              permissions.dataProduct?.Create
                ? [
                    {
                      color: 'primary',
                      iconLeading: Plus,
                      key: 'add-data-product',
                      label: t('label.add-entity', {
                        entity: t('label.data-product'),
                      }),
                      onPress: openDrawer,
                    },
                  ]
                : undefined
            }
            description={t('label.no-data-products-yet-description')}
            icon={<Package className="tw:text-fg-brand-primary" />}
            title={t('label.no-data-products-yet')}
            variant="blank"
          />
        </div>
      );
    }

    if (view === ViewMode.Table) {
      return (
        <>
          <EntityListingTable
            ariaLabel={t('label.data-product')}
            columns={dataProductColumns}
            containerClassName="tw:min-h-0 tw:flex-1 tw:overflow-y-auto"
            entities={dataProductListing.entities}
            loading={dataProductListing.loading}
            renderCell={renderDataProductCell}
            selectedEntities={dataProductListing.selectedEntities}
            onEntityClick={dataProductListing.actionHandlers.onEntityClick}
            onSelect={dataProductListing.handleSelect}
            onSelectAll={dataProductListing.handleSelectAll}
          />
          <PaginationCardDefault
            page={dataProductListing.currentPage}
            total={dataProductListing.totalPages}
            onPageChange={dataProductListing.handlePageChange}
          />
        </>
      );
    }

    return (
      <>
        <EntityCardView
          className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:grid-cols-[repeat(auto-fill,minmax(380px,1fr))]"
          entities={dataProductListing.entities}
          loading={dataProductListing.loading}
          renderCard={renderDataProductCard}
          onEntityClick={dataProductListing.actionHandlers.onEntityClick}
        />
        <PaginationCardDefault
          page={dataProductListing.currentPage}
          total={dataProductListing.totalPages}
          onPageChange={dataProductListing.handlePageChange}
        />
      </>
    );
  }, [
    dataProductListing.loading,
    dataProductListing.entities,
    dataProductListing.selectedEntities,
    dataProductListing.actionHandlers,
    dataProductListing.currentPage,
    dataProductListing.totalPages,
    dataProductListing.handlePageChange,
    dataProductListing.handleSearchChange,
    isSearchOrFilterActive,
    view,
    renderDataProductCell,
    renderDataProductCard,
    openDrawer,
    t,
    permissions.dataProduct?.Create,
  ]);

  return (
    <>
      {!renderPageHeader && !isAiMode && (
        <HeaderBreadcrumb items={breadcrumbItems} />
      )}
      {renderPageHeader
        ? renderPageHeader({
            onAddClick: openDrawer,
            createPermission: permissions.dataProduct?.Create || false,
            count: dataProductListing.totalEntities,
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
            <ViewToggle value={view} onChange={setView} />
            {deleteIconButton}
          </Box>
          {filterSelectionDisplay}
        </Box>
        {content}
      </Card>
      {deleteModal}
      {formDrawer}
    </>
  );
};

const DataProductListPageWithLayout: FC<DataProductListPageProps> = (props) => {
  const isAiMode = useIsAiMode();

  return (
    <PageLayoutV1
      className={isAiMode ? 'tw:h-auto!' : undefined}
      fullHeight={isAiMode}
      pageTitle={props.pageTitle}
      variant={isAiMode ? 'compact' : 'default'}>
      <DataProductListPage {...props} />
    </PageLayoutV1>
  );
};

export { DataProductListPage };

export default DataProductListPageWithLayout;