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
import { startCase } from 'lodash';
import { ReactNode, useMemo } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import {
  SEVERITY_COLORS,
  STATUS_COLORS,
} from '../../../../constants/Color.constants';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../../../constants/TestSuite.constant';
import {
  Severities,
  TestCaseIncidentGroup,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseIncidentGroup';
import {
  formatDate,
  formatDateTimeLong,
} from '../../../../utils/date-time/DateTimeUtils';
import { INCIDENT_GROUPS_SORT_COLUMN } from './IncidentGroups.constants';
import { IncidentGroupsTableProps } from './IncidentGroups.types';
import {
  getAssigneeInitials,
  getIncidentGroupAssignees,
  getIncidentGroupByOption,
  getIncidentGroupName,
  getIncidentGroupSubLine,
} from './IncidentGroups.utils';
import IncidentTrendSparkline from './IncidentTrendSparkline';

/** Key the shared severity palette carries the "no severity" pill under. */
const NO_SEVERITY = 'NoSeverity';

/** Short form of the first-seen date, e.g. `Aug '25`. */
const FIRST_SEEN_FORMAT = "MMM ''yy";

/**
 * The group schema re-declares the incident status enum, so its members are a
 * distinct TS type carrying the same values. Reading the shared labels by value
 * keeps one source of wording for a status the incidents table already names.
 */
const statusLabels: Record<string, string> = TEST_CASE_RESOLUTION_STATUS_LABELS;

const CHIP_CLASS =
  'tw:inline-flex tw:max-w-max tw:items-center tw:whitespace-nowrap tw:rounded-full tw:px-2 tw:py-1 tw:text-xs tw:font-medium tw:leading-none';

/**
 * Both palettes are the ones the editable incident chips already use, so a
 * group reads the same as the incidents it aggregates.
 */
const IncidentGroupChip = ({
  label,
  palette,
  dataTestId,
}: {
  label: string;
  palette: { bg: string; color: string };
  dataTestId: string;
}) => (
  <span
    className={CHIP_CLASS}
    data-testid={dataTestId}
    style={{ backgroundColor: palette.bg, color: palette.color }}>
    {label}
  </span>
);

const StackedCell = ({
  value,
  caption,
  valueTestId,
  captionTestId,
}: {
  value: ReactNode;
  caption?: ReactNode;
  valueTestId: string;
  captionTestId?: string;
}) => (
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

const AssigneesCell = ({ group }: { group: TestCaseIncidentGroup }) => {
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
        <Avatar
          alt={assignee}
          data-testid={`group-assignee-${assignee}`}
          initials={getAssigneeInitials(assignee)}
          key={assignee}
          size="xs"
        />
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

const SeverityCell = ({ severity }: { severity?: Severities }) => {
  const { t } = useTranslation();

  return (
    <IncidentGroupChip
      dataTestId="group-severity"
      label={
        severity
          ? startCase(severity)
          : t('label.no-entity', { entity: t('label.severity') })
      }
      palette={
        SEVERITY_COLORS[severity ?? NO_SEVERITY] ?? SEVERITY_COLORS[NO_SEVERITY]
      }
    />
  );
};

const StatusCell = ({ status }: { status?: TestCaseResolutionStatusTypes }) => {
  const palette = status ? STATUS_COLORS[status] : undefined;

  if (!status || !palette) {
    return <span data-testid="group-status">{NO_DATA_PLACEHOLDER}</span>;
  }

  return (
    <IncidentGroupChip
      dataTestId="group-status"
      label={statusLabels[status] ?? status}
      palette={palette}
    />
  );
};

const LastSeenCell = ({ group }: { group: TestCaseIncidentGroup }) => {
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
            value={getIncidentGroupName(group)}
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
          <SeverityCell severity={group.severity} />
        </Table.Cell>
        <Table.Cell>
          <StatusCell status={group.status} />
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
