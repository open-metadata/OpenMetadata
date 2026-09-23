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

import { FC } from 'react';
import {
  IncidentGroupBy,
  IncidentStatusCount,
  IncidentTrendDirection,
  Severities,
  TestCaseIncidentGroup,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { IncidentSortType } from '../../../../rest/incidentManagerAPI';

export interface IncidentGroupByOption {
  key: IncidentGroupBy;
  labelKey: string;
  icon: FC<{ className?: string }>;
}

export interface IncidentGroupByDropdownProps {
  value: IncidentGroupBy;
  onChange: (groupBy: IncidentGroupBy) => void;
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
