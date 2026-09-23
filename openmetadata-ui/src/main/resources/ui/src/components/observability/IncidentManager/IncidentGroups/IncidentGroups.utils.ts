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
  IncidentGroupBy,
  IncidentStatusCount,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import Fqn from '../../../../utils/Fqn';
import {
  DEFAULT_INCIDENT_GROUP_BY,
  INCIDENT_GROUP_BY_OPTIONS,
  INCIDENT_GROUP_MAX_AVATARS,
  INCIDENT_GROUP_SEPARATOR,
  INCIDENT_GROUP_STATUS_ORDER,
} from './IncidentGroups.constants';
import {
  IncidentGroupByOption,
  IncidentGroupStatusSegment,
} from './IncidentGroups.types';
import { isRecurring } from './IncidentTrendSparkline';

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

export const getIncidentGroupName = (group: TestCaseIncidentGroup): string =>
  group.displayName || group.name;

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
 * contains a dot stays whole; the quotes are then dropped, as they are chrome
 * of the encoding rather than part of the name.
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
    .map((part) => part.replaceAll('"', ''))
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
 * The group's open incidents split into the slices of the status bar, ordered
 * from the most actionable status to the least. Statuses the group has no
 * incident in are dropped rather than drawn as zero-width slices, and a
 * `Resolved` count — which the server does not send, as resolving an incident
 * takes it out of the group — is ignored if one ever arrives.
 */
export const getIncidentGroupStatusSegments = (
  statusCounts?: IncidentStatusCount[]
): IncidentGroupStatusSegment[] => {
  const countByStatus = new Map(
    (statusCounts ?? [])
      .filter(({ count }) => count > 0)
      .map(({ status, count }) => [status, count])
  );
  const present = INCIDENT_GROUP_STATUS_ORDER.filter((status) =>
    countByStatus.has(status)
  );
  const total = present.reduce(
    (sum, status) => sum + (countByStatus.get(status) ?? 0),
    0
  );

  return present.map((status) => {
    const count = countByStatus.get(status) ?? 0;

    return { status, count, share: (count / total) * 100 };
  });
};

/** Up to two initials for an assignee avatar, e.g. `tomas.montiel` → `TM`. */
export const getAssigneeInitials = (assignee: string): string =>
  assignee
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

/**
 * Assignees to draw, and how many more the group has. The count comes from
 * `assigneeCount` — the `assignees` array is capped server-side, so its length
 * would under-report the overflow (and read as 0 once the cap is reached).
 */
export const getIncidentGroupAssignees = (
  group: TestCaseIncidentGroup
): { visible: string[]; overflowCount: number } => {
  const assignees = group.assignees ?? [];
  const visible = assignees.slice(0, INCIDENT_GROUP_MAX_AVATARS);
  const total = group.assigneeCount ?? assignees.length;

  return { visible, overflowCount: Math.max(0, total - visible.length) };
};

/**
 * Recurring groups among the ones currently loaded. The endpoint reports no
 * recurring total, so this only ever describes the page in hand — the chip
 * built on it says so.
 */
export const countRecurringIncidentGroups = (
  groups: TestCaseIncidentGroup[]
): number => groups.filter(isRecurring).length;
