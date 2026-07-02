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

import { Box, Card } from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderEmptyIcon } from '../../assets/svg/folder-empty.svg';
import { ROUTES } from '../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { CreateDomain } from '../../generated/api/domains/createDomain';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useMarketplaceStore } from '../../hooks/useMarketplaceStore';
import { addDomains, patchDomains } from '../../rest/domainAPI';
import { createEntityWithCoverImage } from '../../utils/CoverImageUploadUtils';
import { submitAndClose } from '../../utils/FormDrawerUtils';
import { useDelete } from '../common/atoms/actions/useDelete';
import { useDomainCardTemplates } from '../common/atoms/domain/ui/useDomainCardTemplates';
import { useDomainFilters } from '../common/atoms/domain/ui/useDomainFilters';
import { useDomainTableColumns } from '../common/atoms/domain/ui/useDomainTableColumns';
import { useFormDrawerWithHook } from '../common/atoms/drawer';
import { useFilterSelection } from '../common/atoms/filters/useFilterSelection';
import { usePageHeader } from '../common/atoms/navigation/usePageHeader';
import { useSearch } from '../common/atoms/navigation/useSearch';
import { useTitleAndCount } from '../common/atoms/navigation/useTitleAndCount';
import { useViewToggle } from '../common/atoms/navigation/useViewToggle';
import { usePaginationControls } from '../common/atoms/pagination/usePaginationControls';
import { hasActiveSearchOrFilter } from '../common/atoms/shared/utils/hasActiveSearchOrFilter';
import EntityCardView from '../common/EntityCardView/EntityCardView.component';
import EntityListingTable from '../common/EntityListingTable/EntityListingTable.component';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import HeaderBreadcrumb from '../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import AddDomainForm, {
  DOMAIN_FORM_DEFAULTS,
  transformDomainFormData,
} from '../Domain/AddDomainForm/AddDomainForm.component';
import { DomainFormValues } from '../Domain/AddDomainForm/AddDomainForm.interface';
import { DomainFormType } from '../Domain/DomainPage.interface';
import DomainTreeView from './components/DomainTreeView';
import { useDomainListingData } from './hooks/useDomainListingData';

interface DomainListPageProps {
  pageTitle: string;
  renderPageHeader?: (props: {
    onAddClick: () => void;
    createPermission: boolean;
    count: number;
  }) => ReactNode;
}

const DomainListPage = ({ renderPageHeader }: DomainListPageProps) => {
  const domainListing = useDomainListingData();
  const { isMarketplace, domainBasePath } = useMarketplaceStore();
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const form = useForm<DomainFormValues>({
    defaultValues: DOMAIN_FORM_DEFAULTS,
  });
  const [isLoading, setIsLoading] = useState(false);
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

  const handleDomainSubmit = useCallback(
    async (data: DomainFormValues) => {
      const formData = transformDomainFormData(
        data,
        DomainFormType.DOMAIN
      ) as CreateDomain;
      setIsLoading(true);
      try {
        await createEntityWithCoverImage({
          formData,
          entityType: EntityType.DOMAIN,
          entityLabel: t('label.domain'),
          entityPluralLabel: 'domains',
          createEntity: addDomains,
          patchEntity: patchDomains,
          onSuccess: () => {
            form.reset();
          },
          t,
        });
      } finally {
        setIsLoading(false);
      }
    },

    [form, t]
  );

  const { refetch: refetchDomainListing } = domainListing;

  const refreshAllDomains = useCallback(() => {
    refetchDomainListing();
    setTreeRefreshToken((prev) => prev + 1);
  }, [refetchDomainListing]);

  const { formDrawer, openDrawer, closeDrawer } =
    useFormDrawerWithHook<DomainFormValues>({
      title: t('label.add-entity', { entity: t('label.domain') }),
      width: 670,
      closeOnEscape: false,
      className: 'tw:z-[20]',
      hookForm: form,
      form: (
        <AddDomainForm
          isFormInDialog
          form={form}
          loading={isLoading}
          type={DomainFormType.DOMAIN}
          onCancel={() => {}}
          onSubmit={(data: DomainFormValues): Promise<void> =>
            submitAndClose(
              data,
              handleDomainSubmit,
              closeDrawer,
              refreshAllDomains
            )
          }
        />
      ),
      onSubmit: (data: DomainFormValues): Promise<void> =>
        submitAndClose(
          data,
          handleDomainSubmit,
          closeDrawer,
          refreshAllDomains
        ),
      loading: isLoading,
    });

  const { pageHeader } = usePageHeader({
    titleKey: 'label.domain-plural',
    descriptionMessageKey: 'message.domain-description',
    createPermission: permissions.domain?.Create || false,
    addButtonLabelKey: 'label.add-domain',
    addButtonTestId: 'add-domain',
    onAddClick: openDrawer,
    learningPageId: LEARNING_PAGE_IDS.DOMAIN,
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
  const { renderDomainCard } = useDomainCardTemplates();

  useEffect(() => {
    if (isTreeView && !isEmpty(domainListing.urlState.filters)) {
      domainListing.handleFilterChange([]);
    }
  }, [isTreeView]);

  const { columns: domainColumns, renderCell: renderDomainCell } =
    useDomainTableColumns();

  const { paginationControls } = usePaginationControls({
    currentPage: domainListing.currentPage,
    totalPages: domainListing.totalPages,
    totalEntities: domainListing.totalEntities,
    pageSize: domainListing.pageSize,
    onPageChange: domainListing.handlePageChange,
    loading: domainListing.loading,
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

    if (view === 'table') {
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
          {paginationControls}
        </>
      );
    }

    return (
      <>
        <EntityCardView
          entities={domainListing.entities}
          loading={domainListing.loading}
          renderCard={renderDomainCard}
          onEntityClick={domainListing.actionHandlers.onEntityClick}
        />
        {paginationControls}
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
    isSearchOrFilterActive,
    view,
    renderDomainCell,
    renderDomainCard,
    paginationControls,
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
      {!renderPageHeader && (
        <HeaderBreadcrumb
          items={[
            ...(isMarketplace
              ? [
                  {
                    label: t('label.data-marketplace'),
                    href: ROUTES.DATA_MARKETPLACE,
                  },
                ]
              : []),
            { label: t('label.domain-plural'), href: domainBasePath },
          ]}
        />
      )}
      {renderPageHeader
        ? renderPageHeader({
            onAddClick: openDrawer,
            createPermission: permissions.domain?.Create || false,
            count: domainListing.totalEntities,
          })
        : pageHeader}

      <Card style={{ marginBottom: 20 }} variant="elevated">
        <Box
          className="tw:px-6 tw:py-4 tw:border-b tw:border-secondary"
          direction="col"
          gap={4}>
          <Box align="center" direction="row" gap={5}>
            {titleAndCount}
            {search}
            {!isTreeView && quickFilters}
            <Box className="tw:ml-auto" />
            {viewToggle}
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
