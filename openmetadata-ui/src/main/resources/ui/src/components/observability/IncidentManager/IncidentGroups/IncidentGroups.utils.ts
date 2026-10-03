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

import { castArray, isString, isUndefined, sumBy } from 'lodash';
import { ParsedQs } from 'qs';
import {
  IncidentGroupBy,
  IncidentStatusCount,
  IncidentTrendDirection,
  Severities,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import {
  ListIncidentGroupsParams,
  OpenIncidentStatus,
} from '../../../../rest/incidentManagerAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { computeTotalPages } from '../../../../utils/PaginationUtils';
import {
  DEFAULT_INCIDENT_GROUP_BY,
  DEFAULT_INCIDENT_LIST_DATE_FIELD,
  INCIDENT_GROUP_BY_OPTIONS,
  INCIDENT_GROUP_SEPARATOR,
  INCIDENT_GROUP_STATUS_OPTIONS,
  INCIDENT_TREND_COLORS,
  SPARKLINE_HEIGHT,
  SPARKLINE_INSET,
  SPARKLINE_WIDTH,
} from './IncidentGroups.constants';
import {
  IncidentGroupByOption,
  IncidentGroupFilters,
  IncidentGroupStatusSegment,
  IncidentTrendTone,
} from './IncidentGroups.types';

/**
 * Coerce a raw query string value into a grouping dimension. Anything the API
 * would reject — a missing, repeated or unknown value — falls back to the
 * default dimension instead of firing a request that 400s.
 */
export const parseIncidentGroupBy = (value: unknown): IncidentGroupBy =>
  Object.values(IncidentGroupBy).find((dimension) => dimension === value) ??
  DEFAULT_INCIDENT_GROUP_BY;

const readText = (value: unknown) =>
  isString(value) && value !== '' ? value : undefined;

const readTimestamp = (value: unknown) => {
  const timestamp = Number(readText(value));

  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const isOpenIncidentStatus = (value: unknown): value is OpenIncidentStatus =>
  INCIDENT_GROUP_STATUS_OPTIONS.includes(value as OpenIncidentStatus);

/**
 * The grouped view's filters out of the query string. A value the endpoint
 * would reject — `Resolved`, an unknown status, a non-numeric timestamp, a
 * repeated single-value param — is dropped rather than sent.
 */
export const parseIncidentGroupFilters = (
  params: ParsedQs
): IncidentGroupFilters => ({
  testCaseFQN: readText(params.testCaseFQN),
  assignee: readText(params.assignee),
  status: [...new Set(castArray(params.status ?? []))].filter(
    isOpenIncidentStatus
  ),
  dateField:
    params.dateField === 'updatedAt'
      ? 'updatedAt'
      : DEFAULT_INCIDENT_LIST_DATE_FIELD,
  startTs: readTimestamp(params.startTs),
  endTs: readTimestamp(params.endTs),
});

/** Whether any filter narrows the groups down from every open incident. */
export const hasActiveIncidentGroupFilters = (
  filters: IncidentGroupFilters
): boolean =>
  [filters.testCaseFQN, filters.assignee, filters.startTs, filters.endTs].some(
    (value) => !isUndefined(value)
  ) ||
  filters.status.length > 0 ||
  filters.dateField !== DEFAULT_INCIDENT_LIST_DATE_FIELD;

/**
 * The filters as groups endpoint params. The date field only means something
 * next to a range, and the endpoint names the opening time `createdAt` where
 * the URL says `timestamp`.
 */
export const getIncidentGroupsQuery = ({
  testCaseFQN,
  assignee,
  status,
  dateField,
  startTs,
  endTs,
}: IncidentGroupFilters): Partial<ListIncidentGroupsParams> => {
  const hasRange = !isUndefined(startTs) || !isUndefined(endTs);
  const rangeDateField = dateField === 'updatedAt' ? 'updatedAt' : 'createdAt';

  return {
    testCaseFQN,
    assignee,
    status: status.length > 0 ? status : undefined,
    dateField: hasRange ? rangeDateField : undefined,
    startTs,
    endTs,
  };
};

export const getIncidentGroupByOption = (
  groupBy: IncidentGroupBy
): IncidentGroupByOption =>
  INCIDENT_GROUP_BY_OPTIONS.find((option) => option.key === groupBy) ??
  INCIDENT_GROUP_BY_OPTIONS[0];

/**
 * Sub-line under the group name: the related entities its open incidents span —
 * the test definitions of a table group, the tables of any other. It lists what
 * the server-capped array holds; the related column carries the full count.
 */
const getSubLineEntities = (group: TestCaseIncidentGroup) =>
  (group.groupBy === IncidentGroupBy.Table
    ? group.testDefinitions
    : group.tables) ?? [];

export const getIncidentGroupSubLine = (group: TestCaseIncidentGroup): string =>
  getSubLineEntities(group).map(getEntityName).join(INCIDENT_GROUP_SEPARATOR);

/**
 * The sub-line's entities by FQN, one per line, for its hover title: tables
 * of the same name in two services read alike on the sub-line itself.
 */
export const getIncidentGroupSubLineTitle = (
  group: TestCaseIncidentGroup
): string =>
  getSubLineEntities(group)
    .map((entity) => entity.fullyQualifiedName ?? getEntityName(entity))
    .join('\n');

/**
 * The owner dimension carries one group for the incidents on test cases nobody
 * owns, so unowned work is not silently dropped from the listing. It stands for
 * no entity, which is how it is told apart: the server resolves every other
 * owner group to a user or a team and gives it that entity's id.
 */
export const isUnownedIncidentGroup = (group: TestCaseIncidentGroup): boolean =>
  group.groupBy === IncidentGroupBy.Owner && !group.id;

/**
 * The group's open incidents split into the slices of the status bar. The
 * server already sends them the way the bar draws them — most actionable
 * first, statuses with no incident left out, and never a `Resolved` count,
 * since resolving an incident takes it out of the group — so all that is left
 * is sizing each slice against the group.
 */
export const getIncidentGroupStatusSegments = (
  statusCounts: IncidentStatusCount[] = []
): IncidentGroupStatusSegment[] => {
  const total = sumBy(statusCounts, 'count');

  return statusCounts.map(({ status, count }) => ({
    status,
    count,
    share: (count / total) * 100,
  }));
};

/**
 * A group counts as recurring when its incidents keep coming back faster than
 * they did: the server compares the second half of the trend buckets against
 * the first and reports `Rising`. The header's `recurring` chip is built on the
 * same field as the row's arrow, so the two always agree.
 */
export const isRecurring = (group: TestCaseIncidentGroup): boolean =>
  group.trendDirection === IncidentTrendDirection.Rising;

/**
 * Recurring groups among the ones currently loaded. The endpoint reports no
 * recurring total, so this only ever describes the page in hand — the chip
 * built on it says so.
 */
export const countRecurringIncidentGroups = (
  groups: TestCaseIncidentGroup[]
): number => groups.filter(isRecurring).length;

/**
 * Tone of the trend. Falling incident creation is good news and steady is
 * neither, so only a rising trend is graded — by the severity the group
 * carries, since a rising `Severity1` group is the one to look at first.
 */
export const getIncidentTrendTone = (
  trendDirection?: IncidentTrendDirection,
  severity?: Severities
): IncidentTrendTone => {
  if (trendDirection === IncidentTrendDirection.Rising) {
    return severity === Severities.Severity1 ? 'error' : 'warning';
  }

  return trendDirection === IncidentTrendDirection.Falling
    ? 'success'
    : 'neutral';
};

/** Stroke of the trend line, for the SVG that cannot take a class. */
export const getIncidentTrendColor = (
  trendDirection?: IncidentTrendDirection,
  severity?: Severities
): string =>
  INCIDENT_TREND_COLORS[getIncidentTrendTone(trendDirection, severity)];

/**
 * Bucket counts to `x,y` pairs for an SVG polyline. Buckets are equally spaced
 * across the width and scaled against the tallest bucket, so the line shows the
 * shape of the group's incident creation rather than its absolute volume — a
 * group with 40 incidents and one with 4 are equally readable. An all-zero
 * trend has no shape to scale, so it draws flat through the middle.
 */
export const getIncidentTrendPoints = (trend: number[]): string => {
  const usableWidth = SPARKLINE_WIDTH - SPARKLINE_INSET * 2;
  const usableHeight = SPARKLINE_HEIGHT - SPARKLINE_INSET * 2;
  const peak = Math.max(...trend);
  const stepX = trend.length > 1 ? usableWidth / (trend.length - 1) : 0;

  return trend
    .map((count, index) => {
      const x = SPARKLINE_INSET + index * stepX;
      const y =
        peak === 0
          ? SPARKLINE_INSET + usableHeight / 2
          : SPARKLINE_INSET + (1 - count / peak) * usableHeight;

      return `${x},${y}`;
    })
    .join(' ');
};

/**
 * The page to read instead of `page` when it came back empty though it is not
 * the first: a refresh resolved the last rows on it. Steps back at least one
 * page, so a total that lags behind the rows cannot pin it in place.
 */
export const getPageAfterEmptyRead = (
  rowCount: number,
  page: number,
  pageSize: number,
  total = 0
): number | undefined =>
  rowCount === 0 && page > 1
    ? Math.min(page - 1, Math.max(1, computeTotalPages(pageSize, total)))
    : undefined;
