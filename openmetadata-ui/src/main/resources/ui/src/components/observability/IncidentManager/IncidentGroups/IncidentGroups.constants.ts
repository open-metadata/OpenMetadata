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

import type { BadgeColor, BadgeColors } from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  Table,
  User01,
} from '@openmetadata/ui-core-components/icons';
import {
  TestCaseFailureReasonType,
  TestCaseResolutionStatusTypes as CreateStatusTypes,
} from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import {
  IncidentGroupBy,
  IncidentTrendDirection,
  Severities,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatusTypes as ResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import {
  IncidentGroupSortField,
  OpenIncidentStatus,
} from '../../../../rest/incidentManagerAPI';
import {
  BulkIncidentStatus,
  IncidentGroupByOption,
  IncidentGroupFilters,
  IncidentGroupSort,
  IncidentListDateField,
  IncidentTrendTone,
} from './IncidentGroups.types';

/**
 * Query string param holding the selected grouping dimension. It shares its
 * name with the API param so the URL reads like the request it produces.
 */
export const INCIDENT_GROUP_BY_PARAM = 'groupBy';

/**
 * Query string param naming the group whose drill-down is open, so a reload,
 * a shared link or the browser's Back lands on it again.
 */
export const INCIDENT_GROUP_DETAIL_PARAM = 'group';

/** Dimension the page opens with when the URL does not carry a valid one. */
export const DEFAULT_INCIDENT_GROUP_BY = IncidentGroupBy.TestDefinition;

export const INCIDENT_GROUPS_PAGE_SIZE = 10;

export const INCIDENT_GROUPS_PAGE_SIZE_OPTIONS = [10, 15, 25, 50];

/** Query string params the filters live in — the filter keys themselves. */
export const INCIDENT_GROUP_FILTER_KEYS: (keyof IncidentGroupFilters)[] = [
  'testCaseFQN',
  'assignee',
  'status',
  'dateField',
  'startTs',
  'endTs',
];

/** Statuses a group can be filtered by; a resolved incident has left its group. */
export const INCIDENT_GROUP_STATUS_OPTIONS: OpenIncidentStatus[] = [
  ResolutionStatusTypes.New,
  ResolutionStatusTypes.ACK,
  ResolutionStatusTypes.Assigned,
];

export const DEFAULT_INCIDENT_LIST_DATE_FIELD: IncidentListDateField =
  'timestamp';

/** Every filter key, emptied: an absent date field reads back as the default. */
export const CLEARED_INCIDENT_GROUP_FILTERS: Partial<IncidentGroupFilters> = {
  testCaseFQN: undefined,
  assignee: undefined,
  status: [],
  dateField: undefined,
  startTs: undefined,
  endTs: undefined,
};

export const INCIDENT_GROUP_BY_OPTIONS: IncidentGroupByOption[] = [
  {
    key: IncidentGroupBy.TestDefinition,
    labelKey: 'label.test-case-type',
    icon: CheckCircle,
  },
  {
    key: IncidentGroupBy.Table,
    labelKey: 'label.table',
    icon: Table,
  },
  {
    key: IncidentGroupBy.Owner,
    labelKey: 'label.test-case-owner',
    icon: User01,
  },
];

/** The listing opens on the groups with the most open incidents. */
export const DEFAULT_INCIDENT_GROUP_SORT: IncidentGroupSort = {
  field: 'incidentCount',
  type: 'desc',
};

/**
 * Columns the groups can be ordered by. Each column id is the endpoint's
 * `sortField` value, so a header press maps straight onto a request.
 */
export const INCIDENT_GROUP_SORTABLE_COLUMNS: IncidentGroupSortField[] = [
  'incidentCount',
  'severity',
  'lastSeen',
];

/** Avatars drawn before the stack collapses into a `+N` bubble. */
export const INCIDENT_GROUP_MAX_AVATARS = 3;

/**
 * Badge colour per severity, most severe the hottest. The core badge has no
 * yellow, so `Severity4` takes the cool step between amber and green.
 */
export const INCIDENT_GROUP_SEVERITY_COLOR: Record<
  Severities,
  BadgeColor<'pill-color'>
> = {
  [Severities.Severity1]: 'error',
  [Severities.Severity2]: 'orange',
  [Severities.Severity3]: 'warning',
  [Severities.Severity4]: 'blue-light',
  [Severities.Severity5]: 'success',
};

/** Joins the parts of a group's FQN sub-line and of its status count line. */
export const INCIDENT_GROUP_SEPARATOR = ' · ';

/**
 * Fill of each status' slice. A status chip names itself, so it can carry its
 * hue in the 700 shade over a light fill; a slice is colour alone, and at 700
 * assigned reads brown and ack reads navy rather than as the amber and the blue
 * those statuses are known by. Same hue per status as the chip, at the mid
 * shade the design bars them in — as utility classes rather than palette vars,
 * so the bar follows the theme into dark mode.
 *
 * Partial: `Resolved` has no slice, as a resolved incident has left the group.
 */
export const INCIDENT_GROUP_STATUS_BAR_CLASS: Partial<
  Record<TestCaseResolutionStatusTypes, string>
> = {
  [TestCaseResolutionStatusTypes.Assigned]: 'tw:bg-utility-warning-500',
  [TestCaseResolutionStatusTypes.ACK]: 'tw:bg-utility-blue-light-500',
  [TestCaseResolutionStatusTypes.New]: 'tw:bg-utility-purple-500',
};

/**
 * Wording of the count line under the bar, which reads as a sentence fragment
 * (`3 assigned · 1 ack`) rather than as the title-case chips elsewhere.
 */
export const INCIDENT_GROUP_STATUS_LABELS: Partial<
  Record<TestCaseResolutionStatusTypes, string>
> = {
  [TestCaseResolutionStatusTypes.Assigned]: 'label.assigned-lowercase',
  [TestCaseResolutionStatusTypes.ACK]: 'label.ack-lowercase',
  [TestCaseResolutionStatusTypes.New]: 'label.new-lowercase',
};

/**
 * Pill colour of each incident status: the hue the status bar slices it in, so
 * an incident reads the same in its group's bar and in its own row.
 */
export const INCIDENT_STATUS_BADGE_COLORS: Record<
  ResolutionStatusTypes,
  BadgeColors
> = {
  [ResolutionStatusTypes.New]: 'purple',
  [ResolutionStatusTypes.ACK]: 'blue-light',
  [ResolutionStatusTypes.Assigned]: 'warning',
  [ResolutionStatusTypes.Resolved]: 'success',
};

export const INCIDENT_GROUP_DRAWER_PAGE_SIZE_OPTIONS = [4, 8, 12, 20];

/**
 * Statuses a selection of groups can be moved to. New is left out: the status
 * flow never sends an open incident back to it.
 */
export const BULK_INCIDENT_STATUSES: BulkIncidentStatus[] = [
  CreateStatusTypes.ACK,
  CreateStatusTypes.Assigned,
  CreateStatusTypes.Resolved,
];

/** The dot each status carries in the bulk menu, in the hue of its chip. */
export const BULK_INCIDENT_STATUS_DOT_CLASS: Record<
  BulkIncidentStatus,
  string
> = {
  [CreateStatusTypes.ACK]: 'tw:text-utility-blue-light-500',
  [CreateStatusTypes.Assigned]: 'tw:text-utility-warning-500',
  [CreateStatusTypes.Resolved]: 'tw:text-utility-success-500',
};

export const INCIDENT_FAILURE_REASON_OPTIONS = [
  {
    id: TestCaseFailureReasonType.FalsePositive,
    label: 'label.false-positive',
  },
  { id: TestCaseFailureReasonType.MissingData, label: 'label.missing-data' },
  { id: TestCaseFailureReasonType.Duplicates, label: 'label.duplicate-plural' },
  { id: TestCaseFailureReasonType.OutOfBounds, label: 'label.out-of-bounds' },
  { id: TestCaseFailureReasonType.Other, label: 'label.other' },
];

export const SPARKLINE_WIDTH = 72;
export const SPARKLINE_HEIGHT = 24;
/**
 * Keeps the stroke of a bucket sitting at 0 or at the peak inside the viewBox
 * instead of half-clipped by its edge.
 */
export const SPARKLINE_INSET = 2;

/**
 * Trend line colours, as CSS vars because an SVG `stroke` cannot take a class.
 * Tokens rather than raw palette values so the line follows the active theme.
 */
export const INCIDENT_TREND_COLORS: Record<IncidentTrendTone, string> = {
  error: 'var(--om-color-utility-error-700)',
  warning: 'var(--om-color-utility-orange-700)',
  success: 'var(--om-color-utility-success-700)',
  neutral: 'var(--om-color-utility-gray-700)',
};

/** The same tones for the direction label, which can take a class. */
export const INCIDENT_TREND_TEXT_CLASSES: Record<IncidentTrendTone, string> = {
  error: 'tw:text-utility-error-700',
  warning: 'tw:text-utility-orange-700',
  success: 'tw:text-utility-success-700',
  neutral: 'tw:text-utility-gray-700',
};

export const INCIDENT_TREND_DIRECTION_LABELS: Record<
  IncidentTrendDirection,
  string
> = {
  [IncidentTrendDirection.Rising]: 'label.rising',
  [IncidentTrendDirection.Falling]: 'label.falling',
  [IncidentTrendDirection.Steady]: 'label.steady',
};
