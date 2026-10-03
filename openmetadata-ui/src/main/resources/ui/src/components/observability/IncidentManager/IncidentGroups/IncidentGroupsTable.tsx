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
  AvatarGroup,
  Box,
  Button,
  Checkbox,
  Table,
  toOwnerRefs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronRight,
  Cube01,
  LayersTwo01,
  User01,
} from '@openmetadata/ui-core-components/icons';
import { useMemo } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import {
  IncidentGroupBy,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { IncidentGroupSortField } from '../../../../rest/incidentManagerAPI';
import {
  formatDate,
  formatDateTimeLong,
} from '../../../../utils/date-time/DateTimeUtils';
import IncidentGroupRelatedBadge from './IncidentGroupRelatedBadge';
import {
  INCIDENT_GROUP_MAX_AVATARS,
  INCIDENT_GROUP_SORTABLE_COLUMNS,
} from './IncidentGroups.constants';
import {
  IncidentGroupCellProps,
  IncidentGroupsTableProps,
  StackedCellProps,
} from './IncidentGroups.types';
import {
  getIncidentGroupByOption,
  getIncidentGroupKey,
  getIncidentGroupName,
  getIncidentGroupSubLine,
  getIncidentGroupSubLineTitle,
} from './IncidentGroups.utils';
import IncidentSeverityBadge from './IncidentSeverityBadge';
import IncidentStatusBreakdown from './IncidentStatusBreakdown';
import IncidentTrendSparkline from './IncidentTrendSparkline';

/** Short form of the first-seen date, e.g. `Aug '25`. */
const FIRST_SEEN_FORMAT = "MMM ''yy";

// Truncated text keeps its full value in `title`: a hover reveals it without
// making every cell of a clickable row a focus stop.
const StackedCell = ({
  value,
  valueTitle,
  valueWeight = 'semibold',
  caption,
  captionTitle,
  captionIcon: CaptionIcon,
  valueTestId,
  captionTestId,
}: StackedCellProps) => (
  <Box className="tw:min-w-0 tw:gap-0.5" direction="col">
    <Typography
      as="span"
      className="tw:truncate tw:text-primary"
      data-testid={valueTestId}
      size="text-sm"
      title={valueTitle}
      weight={valueWeight}>
      {value}
    </Typography>
    {caption && (
      <Box align="center" className="tw:min-w-0 tw:text-tertiary" gap={1}>
        {CaptionIcon && (
          <CaptionIcon className="tw:size-3 tw:shrink-0 tw:text-fg-quaternary" />
        )}
        <Typography
          as="span"
          className="tw:truncate"
          data-testid={captionTestId}
          size="text-xs"
          title={captionTitle}>
          {caption}
        </Typography>
      </Box>
    )}
  </Box>
);

/**
 * The group's assignees as the owner stack every other listing draws: a hover
 * card per avatar, and a `+N` that lists the rest. It takes the resolved
 * references, which know whether a name is a user or a team.
 */
const AssigneesCell = ({ group }: IncidentGroupCellProps) => {
  const { t } = useTranslation();
  const assignees = toOwnerRefs(group.assigneeReferences);

  if (assignees.length === 0) {
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
    <span data-testid="group-assignees">
      <AvatarGroup
        maxCount={INCIDENT_GROUP_MAX_AVATARS}
        overflowTitleLabel={t('label.assignee-plural')}
        owners={assignees}
      />
    </span>
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
      valueWeight="regular"
    />
  );
};

/**
 * The loaded incident groups, one row each. Every cell reads a field the groups
 * endpoint already returns — nothing here fetches or mutates. The only control
 * is the ordering, by incident count, severity or last seen, which the caller
 * turns back into a request.
 */
const IncidentGroupsTable = ({
  groups,
  groupBy,
  sort,
  onSortChange,
  onGroupPreview,
  onGroupOpen,
  selectedKeys,
  isSelectable,
  onGroupSelect,
  onPageSelect,
}: IncidentGroupsTableProps) => {
  const { t } = useTranslation();

  const dimension = getIncidentGroupByOption(groupBy);
  // A table group's sub-line lists check types; every other group's, tables.
  const subLineIcon = groupBy === IncidentGroupBy.Table ? LayersTwo01 : Cube01;

  const columns = useMemo(
    () => [
      ...(isSelectable ? [{ id: 'select' }] : []),
      { id: 'name', label: t(dimension.labelKey) },
      {
        id: 'related',
        label: t(
          groupBy === IncidentGroupBy.TestDefinition
            ? 'label.table-plural'
            : 'label.check-type'
        ),
      },
      { id: 'incidentCount', label: t('label.incident-plural') },
      { id: 'severity', label: t('label.severity') },
      { id: 'status', label: t('label.status') },
      { id: 'assignees', label: t('label.assignee-plural') },
      { id: 'lastSeen', label: t('label.last-seen') },
      { id: 'trend', label: t('label.trend') },
      { id: 'open', ariaLabel: t('label.action-plural') },
    ],
    [dimension.labelKey, groupBy, isSelectable, t]
  );

  // react-aria drives the header arrow off the descriptor; `sort` is the same
  // ordering in the shape the endpoint takes it.
  const sortDescriptor: SortDescriptor = {
    column: sort.field,
    direction: sort.type === 'asc' ? 'ascending' : 'descending',
  };

  const selectedOnPage = groups.filter((group) =>
    selectedKeys.has(getIncidentGroupKey(group))
  ).length;

  // A column pressed for the first time opens on its useful end — the most
  // incidents, the worst severity, the latest — where react-aria would start
  // ascending; pressing it again flips it.
  const handleSortChange = (descriptor: SortDescriptor) => {
    const field = descriptor.column as IncidentGroupSortField;
    const isNewColumn = field !== sort.field;

    onSortChange({
      field,
      type:
        isNewColumn || descriptor.direction === 'descending' ? 'desc' : 'asc',
    });
  };

  const renderRow = (group: TestCaseIncidentGroup) => {
    const rowId = getIncidentGroupKey(group);
    const groupName = getIncidentGroupName(
      group,
      t('label.no-entity', { entity: t('label.owner') })
    );

    return (
      <Table.Row
        className="tw:cursor-pointer"
        id={rowId}
        key={rowId}
        onAction={() => onGroupPreview(group)}>
        {isSelectable && (
          <Table.Cell className="tw:w-9 tw:pr-0">
            <Checkbox
              aria-label={t('label.select-entity', { entity: groupName })}
              data-testid={`group-select-${rowId}`}
              isSelected={selectedKeys.has(rowId)}
              slot={null}
              onChange={(isSelected) => onGroupSelect(group, isSelected)}
            />
          </Table.Cell>
        )}
        <Table.Cell className="tw:max-w-72">
          <StackedCell
            caption={getIncidentGroupSubLine(group) || undefined}
            captionIcon={subLineIcon}
            captionTestId="group-sub-line"
            captionTitle={getIncidentGroupSubLineTitle(group)}
            value={groupName}
            valueTestId="group-name"
            valueTitle={group.fullyQualifiedName}
          />
        </Table.Cell>
        <Table.Cell>
          <IncidentGroupRelatedBadge group={group} />
        </Table.Cell>
        <Table.Cell>
          <StackedCell
            caption={t('label.open-lowercase')}
            value={group.incidentCount}
            valueTestId="group-incident-count"
          />
        </Table.Cell>
        <Table.Cell>
          <span data-testid="group-severity">
            <IncidentSeverityBadge severity={group.severity} />
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
        <Table.Cell>
          <Button
            aria-label={t('label.view-entity', { entity: groupName })}
            color="tertiary"
            data-testid={`group-open-${rowId}`}
            iconLeading={ChevronRight}
            size="sm"
            onPress={() => onGroupOpen(group)}
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
      {/* The collection caches its rows and headers; the checkboxes in them
          follow the selection only if it is a dependency. */}
      <Table.Header
        columns={columns}
        dependencies={[selectedOnPage, groups.length]}>
        {(column) =>
          column.id === 'select' ? (
            <Table.Head
              className="tw:w-9 tw:pr-0"
              id={column.id}
              key={column.id}>
              <Checkbox
                aria-label={t('label.select-all')}
                data-testid="group-select-page"
                isIndeterminate={
                  selectedOnPage > 0 && selectedOnPage < groups.length
                }
                isSelected={
                  groups.length > 0 && selectedOnPage === groups.length
                }
                // Not the table's own selection slot: selection is ours, so a
                // row press always previews.
                slot={null}
                onChange={onPageSelect}
              />
            </Table.Head>
          ) : (
            <Table.Head
              allowsSorting={INCIDENT_GROUP_SORTABLE_COLUMNS.includes(
                column.id as IncidentGroupSortField
              )}
              aria-label={column.ariaLabel}
              id={column.id}
              isRowHeader={column.id === 'name'}
              key={column.id}
              label={column.label}
            />
          )
        }
      </Table.Header>
      <Table.Body
        dependencies={[groups, selectedKeys, isSelectable]}
        items={groups}>
        {(group) => renderRow(group)}
      </Table.Body>
    </Table>
  );
};

export default IncidentGroupsTable;
