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
  Breadcrumbs,
  Button,
  PaginationCardWithControls,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowLeft, FilterLines } from '@openmetadata/ui-core-components/icons';
import { Key, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { computeTotalPages } from '../../../../utils/PaginationUtils';
import IncidentGroupRelatedBadge from './IncidentGroupRelatedBadge';
import {
  INCIDENT_GROUPS_PAGE_SIZE,
  INCIDENT_GROUPS_PAGE_SIZE_OPTIONS,
  INCIDENT_GROUP_SEPARATOR,
} from './IncidentGroups.constants';
import { IncidentGroupDetailProps } from './IncidentGroups.types';
import {
  getIncidentGroupName,
  hasActiveIncidentGroupFilters,
} from './IncidentGroups.utils';
import IncidentGroupsLoadError from './IncidentGroupsLoadError';
import IncidentList from './IncidentList';
import IncidentSeverityBadge from './IncidentSeverityBadge';
import { useIncidentGroupIncidents } from './useIncidentGroupIncidents';

const GROUPS_CRUMB = 'groups';

/**
 * The full drill-down of one group: every incident it counts, under the same
 * filters, a page at a time. It stands in for the group table in place, so
 * going back finds the groups as they were left.
 */
const IncidentGroupDetail = ({
  group,
  filters,
  onBack,
  onClearFilters,
}: IncidentGroupDetailProps) => {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLDivElement>(null);
  const {
    incidents,
    paging,
    currentPage,
    pageSize,
    isLoading,
    isError,
    handlePageChange,
    handlePageSizeChange,
    refresh,
  } = useIncidentGroupIncidents({
    group,
    filters,
    defaultPageSize: INCIDENT_GROUPS_PAGE_SIZE,
  });
  const name = getIncidentGroupName(
    group,
    t('label.no-entity', { entity: t('label.owner') })
  );

  // The view replaces the table the user was in, so focus follows it there.
  useEffect(() => headingRef.current?.focus(), []);

  const handleCrumb = (key: Key) => key === GROUPS_CRUMB && onBack();

  return (
    <Box data-testid="incident-group-detail" direction="col" gap={4}>
      <Box align="start" direction="col" gap={2}>
        <Button
          color="link-gray"
          data-testid="incident-group-back"
          iconLeading={ArrowLeft}
          size="sm"
          onPress={onBack}>
          {t('label.back-to-group-plural')}
        </Button>
        <Breadcrumbs
          items={[
            { id: GROUPS_CRUMB, label: t('label.incident-manager') },
            { id: 'group', label: name },
          ]}
          onAction={handleCrumb}
        />
        <div
          data-testid="incident-group-detail-heading"
          ref={headingRef}
          tabIndex={-1}>
          {/* not-prose: Typography wraps a heading in .prose, whose h2 style
              would replace the size and margins given here. */}
          <Typography
            as="h2"
            className="not-prose tw:text-primary"
            size="display-xs"
            weight="semibold">
            {name}
          </Typography>
        </div>
        <Box align="center" gap={3} wrap="wrap">
          <IncidentGroupRelatedBadge group={group} />
          <span data-testid="group-severity">
            <IncidentSeverityBadge severity={group.severity} />
          </span>
          <Typography
            as="span"
            className="tw:text-tertiary"
            data-testid="incident-group-summary"
            size="text-sm">
            <Transi18next
              i18nKey="label.incident-count"
              renderElement={
                <Typography
                  as="span"
                  className="tw:text-primary"
                  weight="semibold"
                />
              }
              values={{ count: group.incidentCount }}
            />
            {INCIDENT_GROUP_SEPARATOR}
            {t('message.incident-group-seen-range', {
              firstSeen: group.firstSeen
                ? formatDate(group.firstSeen)
                : NO_DATA_PLACEHOLDER,
              lastSeen: group.lastSeen
                ? formatDate(group.lastSeen)
                : NO_DATA_PLACEHOLDER,
            })}
          </Typography>
        </Box>
        {/* The groups list's filters carry over, so a count that reads short
            of the group's says why. */}
        {hasActiveIncidentGroupFilters(filters) && (
          <Box
            align="center"
            className="tw:text-tertiary"
            data-testid="incident-group-detail-filtered"
            gap={2}>
            <FilterLines className="tw:size-4 tw:text-fg-quaternary" />
            <Typography as="span" size="text-sm">
              {t('message.incident-group-filtered')}
            </Typography>
            <Button
              color="link-color"
              data-testid="incident-group-detail-clear-filters"
              size="sm"
              onPress={onClearFilters}>
              {t('label.clear-filter-plural')}
            </Button>
          </Box>
        )}
      </Box>
      <TableCard.Root>
        {isError ? (
          <IncidentGroupsLoadError
            data-testid="incident-group-incidents-error"
            onRetry={refresh}
          />
        ) : (
          <IncidentList incidents={incidents} isLoading={isLoading} />
        )}
        <PaginationCardWithControls
          className="tw:border-0"
          page={currentPage}
          pageSize={pageSize}
          pageSizeOptions={INCIDENT_GROUPS_PAGE_SIZE_OPTIONS}
          total={Math.max(
            1,
            computeTotalPages(pageSize, paging?.total ?? incidents.length)
          )}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </TableCard.Root>
    </Box>
  );
};

export default IncidentGroupDetail;
