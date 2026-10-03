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
  Divider,
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
  Search,
  ShieldTick,
  TrendUp01,
} from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { computeTotalPages } from '../../../../utils/PaginationUtils';
import Loader from '../../../common/Loader/Loader';
import IncidentGroupByDropdown from './IncidentGroupByDropdown';
import {
  CLEARED_INCIDENT_GROUP_FILTERS,
  INCIDENT_GROUPS_PAGE_SIZE_OPTIONS,
} from './IncidentGroups.constants';
import { IncidentGroupsViewProps } from './IncidentGroups.types';
import {
  countRecurringIncidentGroups,
  hasActiveIncidentGroupFilters,
} from './IncidentGroups.utils';
import IncidentGroupsFilters from './IncidentGroupsFilters';
import IncidentGroupsTable from './IncidentGroupsTable';
import { useIncidentGroups } from './useIncidentGroups';

const STAT_COUNT_ELEMENT = (
  <Typography as="span" className="tw:text-primary" weight="semibold" />
);

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
    retry,
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
        // As tall as the empty and error states, so the page does not jump.
        <Box
          className="tw:min-h-80 tw:items-center tw:justify-center"
          data-testid="incident-groups-loader">
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
            actions={[
              {
                key: 'retry',
                color: 'secondary',
                label: t('label.retry'),
                onPress: retry,
              },
            ]}
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
      // Filtered down to nothing is not the same as having no incidents.
      return hasActiveIncidentGroupFilters(filters) ? (
        <Box
          className="tw:relative tw:min-h-80 tw:w-full"
          data-testid="incident-groups-no-match">
          <EmptyPlaceholder
            actions={[
              {
                key: 'clear-filters',
                color: 'secondary',
                label: t('label.clear-filter-plural'),
                onPress: () =>
                  handleFiltersChange(CLEARED_INCIDENT_GROUP_FILTERS),
              },
            ]}
            description={t('message.try-adjusting-filter')}
            icon={<Search className="tw:text-fg-quaternary" />}
            title={t('message.no-match-found')}
            variant="blank"
          />
        </Box>
      ) : (
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
  const groupCount = paging?.total ?? incidentGroups.length;

  return (
    <Box
      aria-busy={isLoading}
      className="tw:gap-4"
      data-testid="incident-groups"
      direction="col">
      <Box className="tw:items-center tw:justify-between tw:gap-2">
        {/* Kept when empty, so the dimension picker stays on the right. */}
        <Box align="center" gap={3}>
          {hasStats && (
            <>
              <Typography
                as="span"
                className="tw:text-secondary"
                data-testid="incident-groups-count"
                size="text-sm">
                <Transi18next
                  i18nKey="label.group-count"
                  renderElement={STAT_COUNT_ELEMENT}
                  values={{ count: groupCount }}
                />
              </Typography>
              <Divider className="tw:h-4" orientation="vertical" />
              <Tooltip
                placement="top"
                title={t('message.recurring-groups-loaded')}>
                <TooltipTrigger>
                  <Box align="center" gap={1}>
                    <TrendUp01 className="tw:size-4 tw:text-fg-error-primary" />
                    <Typography
                      as="span"
                      className="tw:text-secondary"
                      data-testid="incident-groups-recurring-count"
                      size="text-sm">
                      <Transi18next
                        i18nKey="label.recurring-count"
                        renderElement={STAT_COUNT_ELEMENT}
                        values={{ count: recurringCount }}
                      />
                    </Typography>
                  </Box>
                </TooltipTrigger>
              </Tooltip>
            </>
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
