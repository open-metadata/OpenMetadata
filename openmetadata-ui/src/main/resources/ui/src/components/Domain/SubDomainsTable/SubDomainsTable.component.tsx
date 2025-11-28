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

import { Box, Paper, TableContainer, useTheme } from '@mui/material';
import { isEmpty } from 'lodash';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderEmptyIcon } from '../../../assets/svg/folder-empty.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { useDelete } from '../../common/atoms/actions/useDelete';
import { useDomainCardTemplates } from '../../common/atoms/domain/ui/useDomainCardTemplates';
import { useDomainFilters } from '../../common/atoms/domain/ui/useDomainFilters';
import { useFilterSelection } from '../../common/atoms/filters/useFilterSelection';
import { useSearch } from '../../common/atoms/navigation/useSearch';
import { useTitleAndCount } from '../../common/atoms/navigation/useTitleAndCount';
import { useViewToggle } from '../../common/atoms/navigation/useViewToggle';
import { usePaginationControls } from '../../common/atoms/pagination/usePaginationControls';
import { useCardView } from '../../common/atoms/table/useCardView';
import { useDataTable } from '../../common/atoms/table/useDataTable';
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
  const theme = useTheme();
  const subdomainListing = useSubdomainListingData({
    parentDomainFqn: domainFqn,
  });

  // Use the same domain filters configuration
  const { quickFilters, defaultFilters } = useDomainFilters({
    isSubDomain: true,
    aggregations: subdomainListing.aggregations || undefined,
    parsedFilters: subdomainListing.parsedFilters,
    onFilterChange: subdomainListing.handleFilterChange,
  });

  // Use the filter selection hook for displaying selected filters
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
  const { domainCardTemplate } = useDomainCardTemplates();

  const { dataTable } = useDataTable({
    listing: subdomainListing,
    enableSelection: true,
    entityLabelKey: 'label.sub-domain',
  });

  const { cardView } = useCardView({
    listing: subdomainListing,
    cardTemplate: domainCardTemplate,
  });

  const { paginationControls } = usePaginationControls({
    currentPage: subdomainListing.currentPage,
    totalPages: subdomainListing.totalPages,
    totalEntities: subdomainListing.totalEntities,
    pageSize: subdomainListing.pageSize,
    onPageChange: subdomainListing.handlePageChange,
    loading: subdomainListing.loading,
  });

  // Map selected IDs to actual entities for the delete hook
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

  const content = useMemo(() => {
    if (!subdomainListing.loading && isEmpty(subdomainListing.entities)) {
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
          type={ERROR_PLACEHOLDER_TYPE.MUI_CREATE}
          onClick={onAddSubDomain}
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
    subdomainListing.loading,
    subdomainListing.entities,
    view,
    dataTable,
    cardView,
    paginationControls,
    permissions.Create,
    onAddSubDomain,
    t,
  ]);

  return (
    <>
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
    </>
  );
};

export default SubDomainsTable;
