/*
 *  Copyright 2026 Collate.
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
  PaginationCardWithControls,
  TableCard,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
// The core-components icon barrel re-exports the design team's own SVG set
// only; it carries no trend glyph, so this one comes from the shared
// `@untitledui/icons` both packages pin at the same range.
import { TrendUp02 } from '@untitledui/icons';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../../enums/common.enum';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../common/Loader/Loader';
import FilterBar from '../../common/FilterChip/FilterBar';
import IncidentGroupByDropdown from './IncidentGroupByDropdown';
import { INCIDENT_GROUPS_PAGE_SIZE_OPTIONS } from './IncidentGroups.constants';
import { IncidentGroupsViewProps } from './IncidentGroups.types';
import { countRecurringIncidentGroups } from './IncidentGroups.utils';
import IncidentGroupsTable from './IncidentGroupsTable';
import { useIncidentGroups } from './useIncidentGroups';
import { useIncidentGroupsFilters } from './useIncidentGroupsFilters';

/**
 * Grouped incident listing: the `Group by` dimension picker, the header stats
 * over the fetched groups, the filter bar, and the group table with its pager —
 * plus the loading/empty/error states of the fetch that feeds them.
 */
const IncidentGroupsView = ({ refreshKey }: IncidentGroupsViewProps) => {
  const { t } = useTranslation();
  const {
    groupBy,
    filters,
    hasActiveFilters,
    incidentGroups,
    paging,
    currentPage,
    pageSize,
    pageCount,
    sortType,
    isLoading,
    isError,
    handleGroupByChange,
    handleSortTypeChange,
    handleFiltersChange,
    clearFilters,
    handlePageChange,
    handlePageSizeChange,
  } = useIncidentGroups({ refreshKey });

  const filterDescriptors = useIncidentGroupsFilters({
    filters,
    onFiltersChange: handleFiltersChange,
  });

  /**
   * Only the loaded page can be counted: the endpoint reports the group total
   * but no recurring total, and a group is recurring by a field that only
   * arrives with the group itself.
   */
  const recurringCount = useMemo(
    () => countRecurringIncidentGroups(incidentGroups),
    [incidentGroups]
  );

  /**
   * A refetch keeps the rows it already has: swapping the table for a loader on
   * every sort click or status change flashes the section away, drops keyboard
   * focus from the sort header, and shifts the incidents table the user is
   * working in. Only a load with nothing to show yet takes the whole space.
   */
  const isInitialLoading = isLoading && isEmpty(incidentGroups);

  const renderContent = () => {
    if (isInitialLoading) {
      return (
        <Box className="tw:py-8" data-testid="incident-groups-loader">
          <Loader />
        </Box>
      );
    }

    if (isError) {
      return (
        <ErrorPlaceHolder
          className="tw:border-none"
          size={SIZE.MEDIUM}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <div data-testid="incident-groups-error">
            {t('server.entity-fetch-error', {
              entity: t('label.incident-plural'),
            })}
          </div>
        </ErrorPlaceHolder>
      );
    }

    if (isEmpty(incidentGroups)) {
      // With filters on, "no active incidents" would claim more than is known:
      // there may well be incidents, just none these filters let through.
      return (
        <ErrorPlaceHolder
          className="tw:border-none"
          placeholderText={
            hasActiveFilters
              ? t('label.no-results-for-filters')
              : t('message.no-active-incidents')
          }
          size={SIZE.MEDIUM}
          type={ERROR_PLACEHOLDER_TYPE.NO_DATA}>
          <div data-testid="incident-groups-empty">
            {hasActiveFilters
              ? t('message.no-data-available-for-selected-filter')
              : t('message.no-active-incidents-description')}
          </div>
        </ErrorPlaceHolder>
      );
    }

    return (
      <>
        <div className="tw:border-b tw:border-secondary">
          <IncidentGroupsTable
            groupBy={groupBy}
            groups={incidentGroups}
            sortType={sortType}
            onSortTypeChange={handleSortTypeChange}
          />
        </div>
        {/* Dimmed while a page is in flight; the hook ignores page changes
            until it lands. */}
        <PaginationCardWithControls
          className={classNames(
            'tw:border-0!',
            isLoading && 'tw:pointer-events-none tw:opacity-60'
          )}
          page={currentPage}
          pageSize={pageSize}
          pageSizeOptions={INCIDENT_GROUPS_PAGE_SIZE_OPTIONS}
          total={pageCount}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </>
    );
  };

  const hasStats = !isInitialLoading && !isError;

  return (
    <Box
      aria-busy={isLoading}
      className="tw:gap-4"
      data-testid="incident-groups"
      direction="col">
      <Box className="tw:items-center tw:justify-between tw:gap-2">
        <Box className="tw:items-center tw:gap-3">
          <Typography
            className="tw:text-secondary"
            data-testid="incident-groups-count"
            size="text-sm"
            weight="semibold">
            {hasStats
              ? t('label.group-count', {
                  count: paging?.total ?? incidentGroups.length,
                })
              : ''}
          </Typography>
          {hasStats && (
            <Tooltip
              placement="top"
              title={t('message.recurring-groups-loaded')}>
              <TooltipTrigger>
                <Box className="tw:items-center tw:gap-1 tw:text-secondary">
                  <TrendUp02 className="tw:size-4" />
                  <Typography
                    as="span"
                    data-testid="incident-groups-recurring-count"
                    size="text-sm"
                    weight="semibold">
                    {t('label.recurring-count', { count: recurringCount })}
                  </Typography>
                </Box>
              </TooltipTrigger>
            </Tooltip>
          )}
        </Box>
        <IncidentGroupByDropdown
          value={groupBy}
          onChange={handleGroupByChange}
        />
      </Box>
      <FilterBar
        filters={filterDescriptors}
        hasActiveFilters={hasActiveFilters}
        variant="input"
        onClearAll={clearFilters}
      />
      <TableCard.Root className="tw:rounded-xl tw:border tw:border-secondary tw:shadow-none tw:outline-0">
        {renderContent()}
      </TableCard.Root>
    </Box>
  );
};

export default IncidentGroupsView;
