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

import { FC, ReactNode } from 'react';
import {
  IncidentGroupBy,
  IncidentStatusCount,
  IncidentTrendDirection,
  Severities,
  TestCaseIncidentGroup,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseIncidentGroup';
import {
  IncidentSortType,
  OpenIncidentStatus,
  TestCaseIncidentStatusParams,
} from '../../../../rest/incidentManagerAPI';

export interface IncidentGroupByOption {
  key: IncidentGroupBy;
  labelKey: string;
  icon: FC<{ className?: string }>;
}

export interface IncidentGroupByDropdownProps {
  value: IncidentGroupBy;
  onChange: (groupBy: IncidentGroupBy) => void;
}

/**
 * Incident timestamp a date range applies to, in the vocabulary the URL already
 * speaks for the incident listing: `timestamp` is when the incident was opened.
 */
export type IncidentListDateField = NonNullable<
  TestCaseIncidentStatusParams['dateField']
>;

/**
 * Filters of the grouped view. Each key is also its query string param, shared
 * with the incident listing on the same page so both read one filter set.
 */
export interface IncidentGroupFilters {
  testCaseFQN?: string;
  assignee?: string;
  status: OpenIncidentStatus[];
  dateField: IncidentListDateField;
  startTs?: number;
  endTs?: number;
}

export interface IncidentGroupsFiltersProps {
  filters: IncidentGroupFilters;
  onChange: (changes: Partial<IncidentGroupFilters>) => void;
}

export interface IncidentGroupsViewProps {
  /**
   * Bumped by the page when an incident it lists below changes status: the
   * groups summarise those incidents, so their counts have to be re-read for
   * the change to show. Every new value costs one fetch — nothing polls.
   */
  refreshKey?: number;
}

export interface IncidentGroupsTableProps {
  groups: TestCaseIncidentGroup[];
  groupBy: IncidentGroupBy;
  sortType: IncidentSortType;
  onSortTypeChange: (sortType: IncidentSortType) => void;
}

/** One status' slice of the breakdown bar, already sized against the group. */
export interface IncidentGroupStatusSegment {
  status: TestCaseResolutionStatusTypes;
  count: number;
  /** Width of the slice, as a percentage of the bar. */
  share: number;
}

export interface IncidentStatusBreakdownProps {
  statusCounts?: IncidentStatusCount[];
}

export interface IncidentTrendSparklineProps {
  trend?: number[];
  trendDirection?: IncidentTrendDirection;
  /** Grades a rising trend; a falling or steady one colours the same either way. */
  severity?: Severities;
}

/** Hue a trend reads in, picked from its direction and the group's severity. */
export type IncidentTrendTone = 'error' | 'warning' | 'success' | 'neutral';

/** A cell that stacks a value over a smaller caption, e.g. a name over its FQN. */
export interface StackedCellProps {
  value: ReactNode;
  /** Full text of the value, shown on hover once it truncates. */
  valueTitle?: string;
  valueWeight?: 'regular' | 'semibold';
  caption?: ReactNode;
  captionTitle?: string;
  captionIcon?: FC<{ className?: string }>;
  valueTestId: string;
  captionTestId?: string;
}

export interface IncidentGroupCellProps {
  group: TestCaseIncidentGroup;
}
