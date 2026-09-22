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
} from '../../../../generated/tests/testCaseIncidentGroup';
import { IncidentSortType } from '../../../../rest/incidentManagerAPI';
import { IncidentGroupByOption } from './IncidentGroups.types';

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

export const INCIDENT_GROUP_FQN_SEPARATOR = ' · ';

export const SPARKLINE_WIDTH = 72;
export const SPARKLINE_HEIGHT = 24;
/**
 * Keeps the stroke of a bucket sitting at 0 or at the peak inside the viewBox
 * instead of half-clipped by its edge.
 */
export const SPARKLINE_INSET = 2;

/**
 * Trend line colours. Tokens rather than raw palette values so the line follows
 * the active theme.
 */
export const INCIDENT_TREND_COLORS = {
  error: 'var(--om-color-utility-error-700)',
  warning: 'var(--om-color-utility-orange-700)',
  success: 'var(--om-color-utility-success-700)',
  neutral: 'var(--om-color-utility-gray-700)',
};

export const INCIDENT_TREND_DIRECTION_LABELS: Record<
  IncidentTrendDirection,
  string
> = {
  [IncidentTrendDirection.Rising]: 'label.rising',
  [IncidentTrendDirection.Falling]: 'label.falling',
  [IncidentTrendDirection.Steady]: 'label.steady',
};
