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
  EmptyPlaceholder,
  PaginationCardWithControls,
  TableCard,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
// The core-components icon barrel re-exports the design team's own SVG set
import {
  AlertCircle,
  ShieldTick,
  TrendUp02,
} from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { computeTotalPages } from '../../../../utils/PaginationUtils';
import Loader from '../../../common/Loader/Loader';
import IncidentGroupByDropdown from './IncidentGroupByDropdown';
import { INCIDENT_GROUPS_PAGE_SIZE_OPTIONS } from './IncidentGroups.constants';
import { IncidentGroupsViewProps } from './IncidentGroups.types';
import { countRecurringIncidentGroups } from './IncidentGroups.utils';
import IncidentGroupsFilters from './IncidentGroupsFilters';
import IncidentGroupsTable from './IncidentGroupsTable';
import { useIncidentGroups } from './useIncidentGroups';

/**
 * Grouped incident listing: the `Group by` dimension picker, the header stats
 * over the fetched groups, the filter row, and the paged group table — plus
 * the loading/empty/error states of the fetch that feeds them.
 */
const IncidentGroupsView = ({ refreshKey }: IncidentGroupsViewProps) => {
  const { t } = useTranslation();
  const {
    groupBy,
    filters,
    incidentGroups,
    paging,
    sortType,
    currentPage,
    pageSize,
    isLoading,
    isError,
    handleGroupByChange,
    handleFiltersChange,
    handleSortTypeChange,
    handlePageChange,
    handlePageSizeChange,
  } = useIncidentGroups({ refreshKey });

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
        <Box
          className="tw:relative tw:min-h-80 tw:w-full"
          data-testid="incident-groups-error">
          <EmptyPlaceholder
            icon={<AlertCircle className="tw:text-fg-error-primary" />}
            title={t('server.entity-fetch-error', {
              entity: t('label.incident-plural'),
            })}
            variant="blank"
          />
        </Box>
      );
    }

    if (isEmpty(incidentGroups)) {
      return (
        <Box
          className="tw:relative tw:min-h-80 tw:w-full"
          data-testid="incident-groups-empty">
          <EmptyPlaceholder
            description={t('message.no-active-incidents-description')}
            icon={<ShieldTick className="tw:text-fg-brand-primary" />}
            title={t('message.no-active-incidents')}
            variant="blank"
          />
        </Box>
      );
    }

    return (
      <TableCard.Root>
        <IncidentGroupsTable
          groupBy={groupBy}
          groups={incidentGroups}
          sortType={sortType}
          onSortTypeChange={handleSortTypeChange}
        />
        <PaginationCardWithControls
          className="tw:border-0"
          page={currentPage}
          pageSize={pageSize}
          pageSizeOptions={INCIDENT_GROUPS_PAGE_SIZE_OPTIONS}
          total={Math.max(
            1,
            computeTotalPages(pageSize, paging?.total ?? incidentGroups.length)
          )}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </TableCard.Root>
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
      <IncidentGroupsFilters filters={filters} onChange={handleFiltersChange} />
      {renderContent()}
    </Box>
  );
};

export default IncidentGroupsView;
