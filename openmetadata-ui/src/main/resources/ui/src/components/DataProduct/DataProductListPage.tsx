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
  Typography,
} from '@openmetadata/ui-core-components';
import { Globe01 } from '@untitledui/icons';
import { useForm } from 'antd/lib/form/Form';
import { isEmpty } from 'lodash';
import { useSnackbar } from 'notistack';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderEmptyIcon } from '../../assets/svg/folder-empty.svg';
import { NO_DATA, ROUTES } from '../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { CreateDataProduct } from '../../generated/api/domains/createDataProduct';
import { CreateDomain } from '../../generated/api/domains/createDomain';
import { DataProduct } from '../../generated/entity/domains/dataProduct';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useMarketplaceStore } from '../../hooks/useMarketplaceStore';
import { addDataProducts, patchDataProduct } from '../../rest/dataProductAPI';
import { createEntityWithCoverImage } from '../../utils/CoverImageUploadUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getEntityAvatarProps } from '../../utils/IconUtils';
import { getClassificationTags, getGlossaryTags } from '../../utils/TagsUtils';
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
import { hasActiveSearchOrFilter } from '../common/atoms/shared/utils/hasActiveSearchOrFilter';
import EntityCardView from '../common/EntityCardView/EntityCardView.component';
import EntityListingTable from '../common/EntityListingTable/EntityListingTable.component';
import { ColumnDef } from '../common/EntityListingTable/EntityListingTable.interface';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { OwnerLabel } from '../common/OwnerLabel/OwnerLabel.component';
import TagBadgeList from '../common/TagBadgeList/TagBadgeList.component';
import AddDomainForm from '../Domain/AddDomainForm/AddDomainForm.component';
import { DomainFormType } from '../Domain/DomainPage.interface';
import { useDataProductListingData } from './hooks/useDataProductListingData';

const DataProductListPage = () => {
  const dataProductListing = useDataProductListingData();
  const { isMarketplace, dataProductBasePath } = useMarketplaceStore();
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { permissions } = usePermissionProvider();
  const [form] = useForm();
  const [isLoading, setIsLoading] = useState(false);

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

  const { formDrawer, openDrawer, closeDrawer } = useFormDrawerWithRef({
    title: t('label.add-entity', { entity: t('label.data-product') }),
    width: 670,
    closeOnEscape: false,
    className: 'tw:z-[20]',
    onCancel: () => {
      form.resetFields();
    },
    form: (
      <AddDomainForm
        isFormInDialog
        formRef={form}
        loading={isLoading}
        type={DomainFormType.DATA_PRODUCT}
        onCancel={() => {}}
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
    onSubmit: () => {},
    loading: isLoading,
  });

  const { breadcrumbs } = useBreadcrumbs({
    items: [
      ...(isMarketplace
        ? [
            {
              name: t('label.data-marketplace'),
              url: ROUTES.DATA_MARKETPLACE,
            },
          ]
        : []),
      { name: t('label.data-product-plural'), url: dataProductBasePath },
    ],
  });

  const { pageHeader } = usePageHeader({
    titleKey: 'label.data-product-plural',
    descriptionMessageKey: 'message.data-product-description',
    createPermission: permissions.dataProduct?.Create || false,
    addButtonLabelKey: 'label.add-data-product',
    onAddClick: openDrawer,
    learningPageId: LEARNING_PAGE_IDS.DATA_PRODUCT,
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

          return (
            <Box align="center" direction="row" gap={3}>
              <Avatar size="md" {...getEntityAvatarProps(entity)} />
              <Box direction="col">
                <Typography size="text-sm" weight="medium">
                  {entityName}
                </Typography>
                {showName && (
                  <Typography size="text-xs">{entity.name}</Typography>
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
            <Box align="center" direction="row" gap={1}>
              <Globe01 size={16} style={{ flexShrink: 0 }} />
              <Typography size="text-sm">
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
    []
  );

  const { paginationControls } = usePaginationControls({
    currentPage: dataProductListing.currentPage,
    totalPages: dataProductListing.totalPages,
    totalEntities: dataProductListing.totalEntities,
    pageSize: dataProductListing.pageSize,
    onPageChange: dataProductListing.handlePageChange,
    loading: dataProductListing.loading,
  });

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
          type={ERROR_PLACEHOLDER_TYPE.CORE_CREATE}
          onClick={openDrawer}
        />
      );
    }

    if (view === 'table') {
      return (
        <>
          <EntityListingTable
            ariaLabel={t('label.data-product')}
            columns={dataProductColumns}
            entities={dataProductListing.entities}
            loading={dataProductListing.loading}
            renderCell={renderDataProductCell}
            selectedEntities={dataProductListing.selectedEntities}
            onEntityClick={dataProductListing.actionHandlers.onEntityClick}
            onSelect={dataProductListing.handleSelect}
            onSelectAll={dataProductListing.handleSelectAll}
          />
          {paginationControls}
        </>
      );
    }

    return (
      <>
        <EntityCardView
          entities={dataProductListing.entities}
          loading={dataProductListing.loading}
          renderCard={renderDataProductCard}
          onEntityClick={dataProductListing.actionHandlers.onEntityClick}
        />
        {paginationControls}
      </>
    );
  }, [
    dataProductListing.loading,
    dataProductListing.entities,
    dataProductListing.selectedEntities,
    dataProductListing.actionHandlers,
    isSearchOrFilterActive,
    view,
    renderDataProductCell,
    renderDataProductCard,
    paginationControls,
    openDrawer,
    t,
    permissions.dataProduct?.Create,
  ]);

  return (
    <>
      {breadcrumbs}
      {pageHeader}

      <Card style={{ marginBottom: 20 }} variant="elevated">
        <Box
          className="tw:px-6 tw:py-4 tw:border-b tw:border-secondary"
          direction="col"
          gap={4}>
          <Box align="center" direction="row" gap={5}>
            {titleAndCount}
            {search}
            {quickFilters}
            <Box className="tw:ml-auto" />
            {viewToggle}
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

export { DataProductListPage };

export default withPageLayout(DataProductListPage);
