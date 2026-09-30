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

import { Table } from '@openmetadata/ui-core-components/icons';
// CheckCircle and User01 have no counterpart in the core-components icon
// barrel, which only re-exports the design team's own SVG set.
import { CheckCircle, User01 } from '@untitledui/icons';
import {
  IncidentGroupBy,
  IncidentTrendDirection,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { IncidentSortType } from '../../../../rest/incidentManagerAPI';
import {
  IncidentGroupByOption,
  IncidentTrendTone,
} from './IncidentGroups.types';

/**
 * Query string param holding the selected grouping dimension. It shares its
 * name with the API param so the URL reads like the request it produces.
 */
export const INCIDENT_GROUP_BY_PARAM = 'groupBy';

/** Dimension the page opens with when the URL does not carry a valid one. */
export const DEFAULT_INCIDENT_GROUP_BY = IncidentGroupBy.TestDefinition;

export const INCIDENT_GROUPS_PAGE_SIZE = 10;

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

/**
 * The listing opens on the groups with the most open incidents; `sortType` is
 * the only ordering the endpoint takes, and it applies to the incident count.
 */
export const DEFAULT_INCIDENT_SORT_TYPE: IncidentSortType = 'desc';

export const INCIDENT_GROUPS_SORT_COLUMN = 'incidentCount';

/**
 * Avatars drawn before the cluster collapses into a `+N` bubble. The server
 * caps the `assignees` array independently, so the overflow is always counted
 * from `assigneeCount` rather than from the array length.
 */
export const INCIDENT_GROUP_MAX_AVATARS = 3;

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
