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
  Badge,
  Box,
  Button,
  Card,
  FeaturedIcon,
  PaginationCardWithControls,
  SlideoutMenu,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
} from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import { computeTotalPages } from '../../../../utils/PaginationUtils';
import IncidentGroupRelatedBadge from './IncidentGroupRelatedBadge';
import {
  INCIDENT_GROUPS_PAGE_SIZE,
  INCIDENT_GROUPS_PAGE_SIZE_OPTIONS,
} from './IncidentGroups.constants';
import {
  IncidentGroupDrawerProps,
  IncidentGroupStatProps,
} from './IncidentGroups.types';
import {
  getIncidentGroupByOption,
  getIncidentGroupName,
} from './IncidentGroups.utils';
import IncidentGroupsLoadError from './IncidentGroupsLoadError';
import IncidentList from './IncidentList';
import IncidentSeverityBadge from './IncidentSeverityBadge';
import { useIncidentGroupIncidents } from './useIncidentGroupIncidents';

const DRAWER_WIDTH = 1040;

const IncidentGroupStat = ({
  icon: Icon,
  label,
  value,
  testId,
}: IncidentGroupStatProps) => (
  <Box className="tw:flex-1 tw:px-4 tw:py-3" direction="col" gap={1}>
    <Box align="center" className="tw:text-secondary" gap={2}>
      <Icon className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary" />
      <Typography as="span" size="text-sm" weight="medium">
        {label}
      </Typography>
    </Box>
    <Typography
      as="span"
      className="tw:text-primary"
      data-testid={testId}
      size="text-md"
      weight="semibold">
      {value}
    </Typography>
  </Box>
);

/**
 * Side panel previewing one group: its summary and a compact, paged list of
 * its incidents, fetched only while the panel is open. The full drill-down is
 * a click away.
 */
const IncidentGroupDrawer = ({
  group,
  filters,
  onClose,
  onViewAll,
  onIncidentChange,
}: IncidentGroupDrawerProps) => {
  const { t } = useTranslation();
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

  return (
    <SlideoutMenu
      isDismissable
      aria-label={t('label.incident-group')}
      isOpen={Boolean(group)}
      width={DRAWER_WIDTH}
      onOpenChange={(isOpen) => !isOpen && onClose()}>
      {({ close }) =>
        group && (
          <>
            <SlideoutMenu.Header
              className="tw:border-b tw:border-secondary tw:pb-4"
              onClose={close}>
              <Box align="center" gap={3}>
                <FeaturedIcon
                  color="brand"
                  icon={getIncidentGroupByOption(group.groupBy).icon}
                  shape="square"
                  size="lg"
                  theme="light">
                  <Badge
                    // Lifted off the icon in both themes, whose fill is brand in dark.
                    className="tw:absolute tw:-right-2 tw:-bottom-1.5 tw:bg-primary"
                    color="brand"
                    data-testid="incident-group-drawer-count"
                    size="sm"
                    type="pill-color">
                    {group.incidentCount}
                  </Badge>
                </FeaturedIcon>
                <Box align="center" className="tw:min-w-0" gap={2} wrap="wrap">
                  {/* not-prose: Typography wraps a heading in .prose, whose h2
                      style would replace the size given here. */}
                  <Typography
                    as="h2"
                    className="not-prose tw:text-primary"
                    data-testid="incident-group-drawer-name"
                    size="text-lg"
                    weight="semibold">
                    {getIncidentGroupName(
                      group,
                      t('label.no-entity', { entity: t('label.owner') })
                    )}
                  </Typography>
                  <IncidentGroupRelatedBadge group={group} />
                  <span data-testid="group-severity">
                    <IncidentSeverityBadge severity={group.severity} />
                  </span>
                </Box>
              </Box>
            </SlideoutMenu.Header>
            <SlideoutMenu.Content className="tw:pb-6">
              {/* Fills the panel without overflowing it: only the incident
                  rows scroll, so the summary and the pager stay in view. */}
              <Box className="tw:h-full tw:min-h-0" direction="col" gap={6}>
                <Card className="tw:flex tw:shrink-0 tw:divide-x tw:divide-secondary">
                  <IncidentGroupStat
                    icon={AlertTriangle}
                    label={t('label.incident-plural')}
                    testId="incident-group-stat-count"
                    value={group.incidentCount}
                  />
                  <IncidentGroupStat
                    icon={Calendar}
                    label={t('label.first-seen')}
                    testId="incident-group-stat-first-seen"
                    value={
                      group.firstSeen
                        ? formatDate(group.firstSeen)
                        : NO_DATA_PLACEHOLDER
                    }
                  />
                  <IncidentGroupStat
                    icon={Clock}
                    label={t('label.last-seen')}
                    testId="incident-group-stat-last-seen"
                    value={
                      group.lastSeen
                        ? formatDate(group.lastSeen)
                        : NO_DATA_PLACEHOLDER
                    }
                  />
                </Card>
                <Box className="tw:min-h-0 tw:flex-1" direction="col" gap={3}>
                  <Box align="center" justify="between">
                    <Box align="center" gap={2}>
                      <Typography
                        as="span"
                        className="tw:text-primary"
                        size="text-md"
                        weight="semibold">
                        {t('label.individual-incident-plural')}
                      </Typography>
                      <Badge
                        color="gray"
                        data-testid="incident-group-incident-count"
                        size="sm"
                        type="pill-color">
                        {paging?.total ?? group.incidentCount}
                      </Badge>
                    </Box>
                    <Button
                      color="link-color"
                      data-testid="incident-group-view-all"
                      iconTrailing={ArrowRight}
                      size="sm"
                      onPress={() => onViewAll(group)}>
                      {t('label.view-all')}
                    </Button>
                  </Box>
                  <TableCard.Root className="tw:flex tw:min-h-0 tw:flex-col">
                    {isError ? (
                      <IncidentGroupsLoadError
                        data-testid="incident-group-incidents-error"
                        onRetry={refresh}
                      />
                    ) : (
                      <IncidentList
                        isScrollable
                        incidents={incidents}
                        isLoading={isLoading}
                        onIncidentChange={() => {
                          refresh();
                          onIncidentChange();
                        }}
                      />
                    )}
                    <PaginationCardWithControls
                      className="tw:shrink-0 tw:border-0"
                      page={currentPage}
                      pageSize={pageSize}
                      pageSizeOptions={INCIDENT_GROUPS_PAGE_SIZE_OPTIONS}
                      total={Math.max(
                        1,
                        computeTotalPages(
                          pageSize,
                          paging?.total ?? incidents.length
                        )
                      )}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  </TableCard.Root>
                </Box>
              </Box>
            </SlideoutMenu.Content>
          </>
        )
      }
    </SlideoutMenu>
  );
};

export default IncidentGroupDrawer;
