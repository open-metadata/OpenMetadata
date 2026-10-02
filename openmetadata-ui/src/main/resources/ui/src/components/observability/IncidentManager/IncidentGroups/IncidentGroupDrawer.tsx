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
  Button,
  PaginationCardWithControls,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import { computeTotalPages } from '../../../../utils/PaginationUtils';
import IncidentGroupRelatedBadge from './IncidentGroupRelatedBadge';
import { INCIDENT_GROUP_DRAWER_PAGE_SIZE_OPTIONS } from './IncidentGroups.constants';
import {
  IncidentGroupDrawerProps,
  IncidentGroupStatProps,
} from './IncidentGroups.types';
import { getIncidentGroupName } from './IncidentGroups.utils';
import IncidentGroupSeverityBadge from './IncidentGroupSeverityBadge';
import IncidentList from './IncidentList';
import { useIncidentGroupIncidents } from './useIncidentGroupIncidents';

const DRAWER_WIDTH = 1040;

const Overline = ({ children }: { children: string }) => (
  <Typography
    as="span"
    className="tw:uppercase tw:text-tertiary"
    size="text-xs"
    weight="semibold">
    {children}
  </Typography>
);

const IncidentGroupStat = ({
  label,
  value,
  testId,
}: IncidentGroupStatProps) => (
  <Box
    className="tw:flex-1 tw:rounded-lg tw:bg-secondary tw:p-3"
    direction="col"
    gap={1}>
    <Overline>{label}</Overline>
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
}: IncidentGroupDrawerProps) => {
  const { t } = useTranslation();
  const {
    incidents,
    paging,
    currentPage,
    pageSize,
    isLoading,
    handlePageChange,
    handlePageSizeChange,
  } = useIncidentGroupIncidents({
    group,
    filters,
    defaultPageSize: INCIDENT_GROUP_DRAWER_PAGE_SIZE_OPTIONS[0],
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
            <SlideoutMenu.Header onClose={close}>
              <Box className="tw:pb-4" direction="col" gap={2}>
                <Overline>{t('label.incident-group')}</Overline>
                <Typography
                  as="h2"
                  className="tw:text-primary"
                  data-testid="incident-group-drawer-name"
                  size="text-lg"
                  weight="semibold">
                  {getIncidentGroupName(
                    group,
                    t('label.no-entity', { entity: t('label.owner') })
                  )}
                </Typography>
                <Box align="center" gap={2} justify="between">
                  <Box align="center" gap={2}>
                    <IncidentGroupRelatedBadge group={group} />
                    <IncidentGroupSeverityBadge severity={group.severity} />
                  </Box>
                  <Button
                    color="link-color"
                    data-testid="incident-group-view-all"
                    size="sm"
                    onPress={() => onViewAll(group)}>
                    {t('label.view-all')}
                  </Button>
                </Box>
                <Box gap={3}>
                  <IncidentGroupStat
                    label={t('label.incident-plural')}
                    testId="incident-group-stat-count"
                    value={group.incidentCount}
                  />
                  <IncidentGroupStat
                    label={t('label.first-seen')}
                    testId="incident-group-stat-first-seen"
                    value={
                      group.firstSeen
                        ? formatDate(group.firstSeen)
                        : NO_DATA_PLACEHOLDER
                    }
                  />
                  <IncidentGroupStat
                    label={t('label.last-seen')}
                    testId="incident-group-stat-last-seen"
                    value={
                      group.lastSeen
                        ? formatDate(group.lastSeen)
                        : NO_DATA_PLACEHOLDER
                    }
                  />
                </Box>
              </Box>
            </SlideoutMenu.Header>
            <SlideoutMenu.Content>
              <Box direction="col" gap={2}>
                <Overline>{t('label.individual-incident-plural')}</Overline>
                <IncidentList incidents={incidents} isLoading={isLoading} />
              </Box>
            </SlideoutMenu.Content>
            <SlideoutMenu.Footer>
              <PaginationCardWithControls
                className="tw:border-0 tw:p-0 tw:shadow-none"
                page={currentPage}
                pageSize={pageSize}
                pageSizeOptions={INCIDENT_GROUP_DRAWER_PAGE_SIZE_OPTIONS}
                total={Math.max(
                  1,
                  computeTotalPages(pageSize, paging?.total ?? incidents.length)
                )}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </SlideoutMenu.Footer>
          </>
        )
      }
    </SlideoutMenu>
  );
};

export default IncidentGroupDrawer;
