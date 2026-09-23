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

import { sumBy } from 'lodash';
import {
  IncidentGroupBy,
  IncidentStatusCount,
  IncidentTrendDirection,
  Severities,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import Fqn from '../../../../utils/Fqn';
import {
  DEFAULT_INCIDENT_GROUP_BY,
  INCIDENT_GROUP_BY_OPTIONS,
  INCIDENT_GROUP_MAX_AVATARS,
  INCIDENT_GROUP_SEPARATOR,
  INCIDENT_TREND_COLORS,
  SPARKLINE_HEIGHT,
  SPARKLINE_INSET,
  SPARKLINE_WIDTH,
} from './IncidentGroups.constants';
import {
  IncidentGroupAssignees,
  IncidentGroupByOption,
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

export const getIncidentGroupByOption = (
  groupBy: IncidentGroupBy
): IncidentGroupByOption =>
  INCIDENT_GROUP_BY_OPTIONS.find((option) => option.key === groupBy) ??
  INCIDENT_GROUP_BY_OPTIONS[0];

/**
 * Sub-line under the group name: everything in the FQN above the group itself,
 * which for a table group is its service, database and schema.
 *
 * Only a table is placed in a hierarchy. A test definition is named by its FQN
 * alone, and an owner's FQN is the user or team name — `adam.matthews` is one
 * name, not a name under `adam` — so both are left without a sub-line rather
 * than split on a dot that means nothing there.
 *
 * The table FQN is split on the quoting rules rather than on `.` so a part that
 * contains a dot stays whole; each part is then unquoted, as the quotes are
 * chrome of the encoding rather than part of the name.
 */
export const getIncidentGroupSubLine = (
  group: TestCaseIncidentGroup
): string => {
  const fullyQualifiedName = group.fullyQualifiedName;

  if (group.groupBy !== IncidentGroupBy.Table || !fullyQualifiedName) {
    return '';
  }

  return Fqn.split(fullyQualifiedName)
    .slice(0, -1)
    .map((part) => Fqn.unquoteName(part))
    .join(INCIDENT_GROUP_SEPARATOR);
};

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
 * Assignees to draw, and how many more the group has. The count comes from
 * `assigneeCount` — the `assignees` array is capped server-side, so its length
 * would under-report the overflow (and read as 0 once the cap is reached).
 */
export const getIncidentGroupAssignees = (
  group: TestCaseIncidentGroup
): IncidentGroupAssignees => {
  const assignees = group.assignees ?? [];
  const visible = assignees.slice(0, INCIDENT_GROUP_MAX_AVATARS);
  const total = group.assigneeCount ?? assignees.length;

  return { visible, overflowCount: Math.max(0, total - visible.length) };
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
