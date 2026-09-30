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
  Avatar,
  BadgeWithIcon,
  Box,
  Table,
  Typography,
} from '@openmetadata/ui-core-components';
// The core-components icon barrel re-exports the design team's own SVG set
// only; it carries no generic person glyph, so this one comes from the shared
// `@untitledui/icons` both packages pin at the same range.
import { User01 } from '@untitledui/icons';
import { useMemo } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import {
  Severities,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { Severities as ResolutionSeverities } from '../../../../generated/tests/testCaseResolutionStatus';
import {
  formatDate,
  formatDateTimeLong,
} from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import InlineSeverity from '../../../DataQuality/IncidentManager/Severity/InlineSeverity.component';
import { INCIDENT_GROUPS_SORT_COLUMN } from './IncidentGroups.constants';
import {
  IncidentGroupCellProps,
  IncidentGroupsTableProps,
  StackedCellProps,
} from './IncidentGroups.types';
import {
  getIncidentGroupAssignees,
  getIncidentGroupByOption,
  getIncidentGroupSubLine,
  isUnownedIncidentGroup,
} from './IncidentGroups.utils';
import IncidentStatusBreakdown from './IncidentStatusBreakdown';
import IncidentTrendSparkline from './IncidentTrendSparkline';

/** Short form of the first-seen date, e.g. `Aug '25`. */
const FIRST_SEEN_FORMAT = "MMM ''yy";

/**
 * The groups schema `$ref`s the severity of a resolution status, but the TS
 * generator emits one enum per schema file, so the two are nominally distinct
 * with identical members. This bridges them for the shared severity chip.
 */
const toResolutionSeverity = (severity?: Severities) =>
  severity as unknown as ResolutionSeverities | undefined;

/** Matches the avatars the incident rows below draw for their assignees. */
const ASSIGNEE_AVATAR_WIDTH = '24';

const StackedCell = ({
  value,
  caption,
  valueTestId,
  captionTestId,
}: StackedCellProps) => (
  <Box className="tw:gap-0.5" direction="col">
    <Typography
      as="span"
      className="tw:text-primary"
      data-testid={valueTestId}
      size="text-sm"
      weight="semibold">
      {value}
    </Typography>
    {caption && (
      <Typography
        as="span"
        className="tw:text-tertiary"
        data-testid={captionTestId}
        size="text-xs">
        {caption}
      </Typography>
    )}
  </Box>
);

/**
 * The assignee names the group carries, drawn by the app's standard avatar so a
 * group row reads the same as the incident rows it aggregates. Only the `+N`
 * bubble is local to the group: it counts from `assigneeCount`, which no single
 * user's avatar knows about.
 */
const AssigneesCell = ({ group }: IncidentGroupCellProps) => {
  const { t } = useTranslation();
  const { visible, overflowCount } = getIncidentGroupAssignees(group);

  if (visible.length === 0 && overflowCount === 0) {
    return (
      <Box className="tw:items-center tw:gap-1 tw:text-tertiary">
        <User01 className="tw:size-4" />
        <Typography as="span" size="text-sm">
          {t('label.none')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="tw:items-center tw:gap-1" data-testid="group-assignees">
      {visible.map((assignee) => (
        // ProfilePicture takes no `data-testid`, so the hook sits on a wrapper.
        <span data-testid={`group-assignee-${assignee}`} key={assignee}>
          <ProfilePicture name={assignee} width={ASSIGNEE_AVATAR_WIDTH} />
        </span>
      ))}
      {overflowCount > 0 && (
        <Avatar
          colorVariant="neutral"
          data-testid="group-assignee-overflow"
          initials={`+${overflowCount}`}
          size="xs"
        />
      )}
    </Box>
  );
};

const LastSeenCell = ({ group }: IncidentGroupCellProps) => {
  const { t } = useTranslation();

  return (
    <StackedCell
      caption={
        group.firstSeen
          ? t('label.first-seen-date', {
              date: formatDateTimeLong(group.firstSeen, FIRST_SEEN_FORMAT),
            })
          : undefined
      }
      captionTestId="group-first-seen"
      value={group.lastSeen ? formatDate(group.lastSeen) : NO_DATA_PLACEHOLDER}
      valueTestId="group-last-seen"
    />
  );
};

/**
 * The loaded incident groups, one row each. Every cell reads a field the groups
 * endpoint already returns — nothing here fetches or mutates. The only control
 * is the incident-count sort, which the endpoint takes as `sortType` and the
 * caller turns back into a request.
 */
const IncidentGroupsTable = ({
  groups,
  groupBy,
  sortType,
  onSortTypeChange,
}: IncidentGroupsTableProps) => {
  const { t } = useTranslation();

  const dimension = getIncidentGroupByOption(groupBy);
  const DimensionIcon = dimension.icon;

  const columns = useMemo(
    () => [
      { id: 'name', label: t(dimension.labelKey) },
      { id: 'dimension', label: t('label.dimension') },
      {
        id: INCIDENT_GROUPS_SORT_COLUMN,
        label: t('label.incident-plural'),
        allowsSorting: true,
      },
      { id: 'severity', label: t('label.severity') },
      { id: 'status', label: t('label.status') },
      { id: 'assignees', label: t('label.assignee-plural') },
      { id: 'lastSeen', label: t('label.last-seen') },
      { id: 'trend', label: t('label.trend') },
    ],
    [dimension.labelKey, t]
  );

  // react-aria drives the header arrow off the descriptor; `sortType` is the
  // same ordering in the shape the endpoint takes it.
  const sortDescriptor: SortDescriptor = {
    column: INCIDENT_GROUPS_SORT_COLUMN,
    direction: sortType === 'asc' ? 'ascending' : 'descending',
  };

  const handleSortChange = (descriptor: SortDescriptor) =>
    onSortTypeChange(descriptor.direction === 'ascending' ? 'asc' : 'desc');

  const renderRow = (group: TestCaseIncidentGroup) => {
    const rowId = group.id ?? group.fullyQualifiedName ?? group.name;

    return (
      <Table.Row id={rowId} key={rowId}>
        <Table.Cell>
          <StackedCell
            caption={getIncidentGroupSubLine(group) || undefined}
            captionTestId="group-sub-line"
            value={
              // The unowned bucket stands for no entity, so it is named here
              // rather than after something the server resolved.
              isUnownedIncidentGroup(group)
                ? t('label.no-entity', { entity: t('label.owner') })
                : getEntityName(group)
            }
            valueTestId="group-name"
          />
        </Table.Cell>
        <Table.Cell>
          {/* BadgeWithIcon takes no `data-testid`, so the hook sits on a
              wrapper rather than on the pill itself. */}
          <span data-testid="group-dimension">
            <BadgeWithIcon color="gray" iconLeading={DimensionIcon} size="sm">
              {t(dimension.labelKey)}
            </BadgeWithIcon>
          </span>
        </Table.Cell>
        <Table.Cell>
          <StackedCell
            caption={t('label.open-lowercase')}
            value={group.incidentCount}
            valueTestId="group-incident-count"
          />
        </Table.Cell>
        <Table.Cell>
          {/* The same read-only chip the incident rows below render, so the
              group and its incidents cannot drift apart in palette or wording.
              InlineSeverity takes no `data-testid`; the hook sits on a wrapper. */}
          <span data-testid="group-severity">
            <InlineSeverity
              hasEditPermission={false}
              severity={toResolutionSeverity(group.severity)}
            />
          </span>
        </Table.Cell>
        <Table.Cell>
          <IncidentStatusBreakdown statusCounts={group.statusCounts} />
        </Table.Cell>
        <Table.Cell>
          <AssigneesCell group={group} />
        </Table.Cell>
        <Table.Cell className="tw:whitespace-nowrap">
          <LastSeenCell group={group} />
        </Table.Cell>
        <Table.Cell>
          <IncidentTrendSparkline
            severity={group.severity}
            trend={group.trend}
            trendDirection={group.trendDirection}
          />
        </Table.Cell>
      </Table.Row>
    );
  };

  return (
    <Table
      aria-label={t('label.incident-plural')}
      data-testid="incident-groups-table"
      size="sm"
      sortDescriptor={sortDescriptor}
      onSortChange={handleSortChange}>
      <Table.Header columns={columns}>
        {(column) => (
          <Table.Head
            allowsSorting={column.allowsSorting}
            id={column.id}
            isRowHeader={column.id === 'name'}
            key={column.id}
            label={column.label}
          />
        )}
      </Table.Header>
      <Table.Body dependencies={[groups]} items={groups}>
        {(group) => renderRow(group)}
      </Table.Body>
    </Table>
  );
};

export default IncidentGroupsTable;
