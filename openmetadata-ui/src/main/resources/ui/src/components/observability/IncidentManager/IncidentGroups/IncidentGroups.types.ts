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
  CreateTestCaseResolutionStatus,
  Severities as CreateSeverities,
  TestCaseResolutionStatusTypes as CreateStatusTypes,
} from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import {
  IncidentGroupBy,
  IncidentStatusCount,
  IncidentTrendDirection,
  Severities,
  TestCaseIncidentGroup,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatus } from '../../../../generated/tests/testCaseResolutionStatus';
import { Response as BulkResponse } from '../../../../generated/type/bulkOperationResult';
import { EntityReference } from '../../../../generated/type/entityReference';
import {
  IncidentGroupSortField,
  IncidentSortType,
  OpenIncidentStatus,
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
 * Incident timestamp a date range applies to, in the incident list endpoint's
 * vocabulary: `timestamp` is when the incident was opened.
 */
export type IncidentListDateField = 'timestamp' | 'updatedAt';

/** A severity to filter by, or `none` for the incidents that carry none. */
export type IncidentSeverityFilter = `${Severities}` | 'none';

/**
 * Filters of the grouped view. Each key is also its query string param, so a
 * shared link or a reload keeps them.
 */
export interface IncidentGroupFilters {
  testCaseFQN?: string;
  assignee?: string;
  status: OpenIncidentStatus[];
  severity: IncidentSeverityFilter[];
  dateField: IncidentListDateField;
  startTs?: number;
  endTs?: number;
}

export interface IncidentGroupsFiltersProps {
  filters: IncidentGroupFilters;
  onChange: (changes: Partial<IncidentGroupFilters>) => void;
}

export interface IncidentGroupsLoadErrorProps {
  onRetry: () => void;
  'data-testid': string;
}

export interface IncidentListProps {
  incidents: TestCaseResolutionStatus[];
  isLoading: boolean;
  /** An incident's status or severity was changed from its row. */
  onIncidentChange?: () => void;
}

export interface IncidentGroupDrawerProps {
  /** The group to preview; the drawer is open while there is one. */
  group?: TestCaseIncidentGroup;
  filters: IncidentGroupFilters;
  onClose: () => void;
  onViewAll: (group: TestCaseIncidentGroup) => void;
  /** One of the group's incidents was changed, so the groups are stale. */
  onIncidentChange: () => void;
}

export interface IncidentGroupDetailProps {
  group: TestCaseIncidentGroup;
  filters: IncidentGroupFilters;
  onBack: () => void;
  onClearFilters: () => void;
  /** One of the group's incidents was changed, so the groups are stale. */
  onIncidentChange: () => void;
}

export interface IncidentGroupStatProps {
  label: string;
  value: ReactNode;
  testId: string;
}

/** A status a selection of groups can be moved to in bulk. */
export type BulkIncidentStatus =
  | CreateStatusTypes.ACK
  | CreateStatusTypes.Assigned
  | CreateStatusTypes.Resolved;

/** What a status change carries on top of the status: an assignee, a reason. */
export type BulkIncidentDetails = NonNullable<
  CreateTestCaseResolutionStatus['testCaseResolutionStatusDetails']
>;

/** What a bulk action does to every open incident of the selected groups. */
export type BulkIncidentChange =
  | {
      kind: 'status';
      status: BulkIncidentStatus;
      details?: BulkIncidentDetails;
    }
  | { kind: 'severity'; severity: CreateSeverities };

/** A bulk change picked from the selection bar, waiting to be confirmed. */
export type PendingBulkChange =
  | { kind: 'status'; status: BulkIncidentStatus }
  | { kind: 'severity'; severity: CreateSeverities };

/** What the bulk status form collects, before it becomes the entries' details. */
export interface BulkStatusFormValues {
  assignee?: { value: EntityReference };
  /** The picked option of the reason select, which holds the whole option. */
  testCaseFailureReason?: { id: string };
  testCaseFailureComment?: string;
}

/** What a bulk change came to, over every call it took. */
export interface BulkIncidentOutcome {
  /** Entries sent: the incidents the change would alter. */
  total: number;
  passed: number;
  failures: BulkResponse[];
  /** Incidents left out: the change would not alter them, or they cannot take it. */
  unchanged: number;
}

export interface IncidentGroupBulkStatusModalProps {
  /** The change being confirmed; the modal is open while there is one. */
  change?: PendingBulkChange;
  /**
   * Open incidents the selected groups count. An incident in two of them is
   * counted twice, so it is the most Apply can touch.
   */
  incidentCount: number;
  isApplying: boolean;
  onCancel: () => void;
  onApply: (details?: BulkIncidentDetails) => void;
}

export interface IncidentGroupsSelectionBarProps {
  selectedCount: number;
  /** Open incidents across the selected groups, at most: see the modal's. */
  incidentCount: number;
  isApplying: boolean;
  onSetStatus: (status: BulkIncidentStatus) => void;
  onSetSeverity: (severity: CreateSeverities) => void;
  onClearSelection: () => void;
}

export interface IncidentGroupBulkFailuresModalProps {
  /** The outcome to report; the modal is open while there is one. */
  outcome?: BulkIncidentOutcome;
  onClose: () => void;
}

/** How the groups are ordered, in the shape the endpoint takes it. */
export interface IncidentGroupSort {
  field: IncidentGroupSortField;
  type: IncidentSortType;
}

export interface IncidentGroupsViewProps {
  /** Whether the user may change incidents, which the bulk actions do. */
  canEditIncidents: boolean;
}

export interface IncidentGroupsTableProps {
  groups: TestCaseIncidentGroup[];
  groupBy: IncidentGroupBy;
  sort: IncidentGroupSort;
  onSortChange: (sort: IncidentGroupSort) => void;
  /** Pressing a row previews its group in the drawer. */
  onGroupPreview: (group: TestCaseIncidentGroup) => void;
  /** The row's open affordance drills into the group. */
  onGroupOpen: (group: TestCaseIncidentGroup) => void;
  /**
   * Groups picked for a bulk change, by group key. Selection is through each
   * row's checkbox alone, so pressing a row always previews it.
   */
  selectedKeys: ReadonlySet<string>;
  /** Without it there is nothing to do to a selection, so rows have no checkbox. */
  isSelectable: boolean;
  onGroupSelect: (group: TestCaseIncidentGroup, isSelected: boolean) => void;
  /** The header checkbox: every group on the page, or none of them. */
  onPageSelect: (isSelected: boolean) => void;
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
