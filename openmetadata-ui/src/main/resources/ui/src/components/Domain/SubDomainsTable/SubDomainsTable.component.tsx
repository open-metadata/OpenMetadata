/*
 *  Copyright 2024 Collate.
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
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderEmptyIcon } from '../../../assets/svg/folder-empty.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { useDelete } from '../../common/atoms/actions/useDelete';
import { useDomainCardTemplates } from '../../common/atoms/domain/ui/useDomainCardTemplates';
import { useDomainFilters } from '../../common/atoms/domain/ui/useDomainFilters';
import { useDomainTableColumns } from '../../common/atoms/domain/ui/useDomainTableColumns';
import { useFilterSelection } from '../../common/atoms/filters/useFilterSelection';
import { useSearch } from '../../common/atoms/navigation/useSearch';
import { useTitleAndCount } from '../../common/atoms/navigation/useTitleAndCount';
import { useViewToggle } from '../../common/atoms/navigation/useViewToggle';
import { usePaginationControls } from '../../common/atoms/pagination/usePaginationControls';
import { hasActiveSearchOrFilter } from '../../common/atoms/shared/utils/hasActiveSearchOrFilter';
import EntityCardView from '../../common/EntityCardView/EntityCardView.component';
import EntityListingTable from '../../common/EntityListingTable/EntityListingTable.component';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { useSubdomainListingData } from './hooks/useSubdomainListingData';
import { SubDomainsTableProps } from './SubDomainsTable.interface';

const SubDomainsTable = ({
  domainFqn,
  permissions,
  onAddSubDomain,
  subDomainsCount,
  onDeleteSubDomain,
}: SubDomainsTableProps) => {
  const { t } = useTranslation();
  const subdomainListing = useSubdomainListingData({
    parentDomainFqn: domainFqn,
  });

  const { quickFilters, defaultFilters } = useDomainFilters({
    isSubDomain: true,
    aggregations: subdomainListing.aggregations || undefined,
    parsedFilters: subdomainListing.parsedFilters,
    onFilterChange: subdomainListing.handleFilterChange,
  });

  const { filterSelectionDisplay } = useFilterSelection({
    urlState: subdomainListing.urlState,
    filterConfigs: defaultFilters,
    parsedFilters: subdomainListing.parsedFilters,
    onFilterChange: subdomainListing.handleFilterChange,
  });

  const { titleAndCount } = useTitleAndCount({
    titleKey: 'label.sub-domain-plural',
    count: subdomainListing.totalEntities,
    loading: subdomainListing.loading,
  });

  const { search } = useSearch({
    searchPlaceholder: t('label.search-entity', {
      entity: t('label.sub-domain'),
    }),
    onSearchChange: subdomainListing.handleSearchChange,
    initialSearchQuery: subdomainListing.urlState.searchQuery,
  });

  const { view, viewToggle } = useViewToggle();
  const { renderDomainCard } = useDomainCardTemplates();

  const { columns: subDomainColumns, renderCell: renderSubDomainCell } =
    useDomainTableColumns({
      nameLabelKey: 'label.sub-domain',
      tagSize: 'lg',
    });

  const { paginationControls } = usePaginationControls({
    currentPage: subdomainListing.currentPage,
    totalPages: subdomainListing.totalPages,
    totalEntities: subdomainListing.totalEntities,
    pageSize: subdomainListing.pageSize,
    onPageChange: subdomainListing.handlePageChange,
    loading: subdomainListing.loading,
  });

  const selectedSubdomainEntities = useMemo(
    () =>
      subdomainListing.entities.filter((entity) =>
        subdomainListing.selectedEntities.includes(entity.id)
      ),
    [subdomainListing.entities, subdomainListing.selectedEntities]
  );

  const { deleteIconButton, deleteModal } = useDelete({
    entityType: 'domains',
    entityLabel: 'Sub-domain',
    selectedEntities: selectedSubdomainEntities,
    onDeleteComplete: () => {
      subdomainListing.clearSelection();
      subdomainListing.refetch();
      onDeleteSubDomain();
    },
  });

  useEffect(() => {
    if (subDomainsCount) {
      subdomainListing.refetch();
    }
  }, [subDomainsCount]);

  const isSearchOrFilterActive = useCallback(
    () => hasActiveSearchOrFilter(subdomainListing.urlState),
    [subdomainListing.urlState]
  );

  const content = useMemo(() => {
    if (!subdomainListing.loading && isEmpty(subdomainListing.entities)) {
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
          buttonId="subdomain-add-button"
          buttonTitle={t('label.add-entity', { entity: t('label.sub-domain') })}
          className="border-none"
          heading={t('message.no-data-message', {
            entity: t('label.sub-domain-lowercase-plural'),
          })}
          icon={<FolderEmptyIcon />}
          permission={permissions.Create}
          type={ERROR_PLACEHOLDER_TYPE.CORE_CREATE}
          onClick={onAddSubDomain}
        />
      );
    }

    if (view === 'table') {
      return (
        <>
          <EntityListingTable
            ariaLabel={t('label.sub-domain')}
            columns={subDomainColumns}
            entities={subdomainListing.entities}
            loading={subdomainListing.loading}
            renderCell={renderSubDomainCell}
            selectedEntities={subdomainListing.selectedEntities}
            onEntityClick={subdomainListing.actionHandlers.onEntityClick}
            onSelect={subdomainListing.handleSelect}
            onSelectAll={subdomainListing.handleSelectAll}
          />
          {paginationControls}
        </>
      );
    }

    return (
      <>
        <EntityCardView
          entities={subdomainListing.entities}
          loading={subdomainListing.loading}
          renderCard={renderDomainCard}
          onEntityClick={subdomainListing.actionHandlers.onEntityClick}
        />
        {paginationControls}
      </>
    );
  }, [
    subdomainListing.loading,
    subdomainListing.entities,
    subdomainListing.selectedEntities,
    subdomainListing.actionHandlers,
    isSearchOrFilterActive,
    view,
    renderSubDomainCell,
    renderDomainCard,
    paginationControls,
    permissions.Create,
    onAddSubDomain,
    t,
  ]);

  return (
    <>
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
    </>
  );
};

export default SubDomainsTable;
