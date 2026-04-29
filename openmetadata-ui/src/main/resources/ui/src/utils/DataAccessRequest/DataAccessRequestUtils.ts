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
  DataAccessRequestPayload,
  DataAccessType,
  Task,
  TaskEntityStatus,
  TaskResolutionType,
} from '../../rest/tasksAPI';

export const ACCESS_TYPE_OPTIONS = [
  {
    value: DataAccessType.FullAccess,
    labelKey: 'label.full-access',
    descriptionKey: 'message.full-access-description',
  },
  {
    value: DataAccessType.ColumnLevel,
    labelKey: 'label.selected-columns',
    descriptionKey: 'message.column-level-access-description',
  },
  {
    value: DataAccessType.Masked,
    labelKey: 'label.masked',
    descriptionKey: 'message.masked-access-description',
  },
];

export const DURATION_OPTIONS = [
  { value: 'P7D', labelKey: 'label.duration-seven-days' },
  { value: 'P14D', labelKey: 'label.duration-fourteen-days' },
  { value: 'P30D', labelKey: 'label.duration-thirty-days' },
  { value: 'P90D', labelKey: 'label.duration-ninety-days' },
  { value: 'P180D', labelKey: 'label.duration-one-eighty-days' },
  { value: 'P1Y', labelKey: 'label.duration-one-year' },
];

export const STATUS_TO_TONE: Record<TaskEntityStatus, string> = {
  [TaskEntityStatus.Open]: 'warning',
  [TaskEntityStatus.Pending]: 'warning',
  [TaskEntityStatus.InProgress]: 'info',
  [TaskEntityStatus.Approved]: 'success',
  [TaskEntityStatus.Rejected]: 'error',
  [TaskEntityStatus.Completed]: 'success',
  [TaskEntityStatus.Cancelled]: 'default',
  [TaskEntityStatus.Failed]: 'error',
  [TaskEntityStatus.Revoked]: 'error',
};

const TERMINAL_STATUSES = new Set<TaskEntityStatus>([
  TaskEntityStatus.Approved,
  TaskEntityStatus.Rejected,
  TaskEntityStatus.Completed,
  TaskEntityStatus.Cancelled,
  TaskEntityStatus.Failed,
  TaskEntityStatus.Revoked,
]);

export const getDisplayStatus = (task: Task): string => {
  // Mark approved-but-expired requests as "Expired" in the UI
  const payload = task.payload as DataAccessRequestPayload | undefined;
  if (
    task.workflowStageId === 'approved' &&
    isExpired(task.createdAt, payload?.duration, payload?.expirationDate)
  ) {
    return 'Expired';
  }

  if (
    !TERMINAL_STATUSES.has(task.status) &&
    task.workflowStageDisplayName
  ) {
    return task.workflowStageDisplayName;
  }

  if (task.status === TaskEntityStatus.Open) {
    return 'Pending';
  }

  return task.status;
};

export const getDisplayStatusTone = (task: Task): string => {
  const display = getDisplayStatus(task);

  if (display === 'Approved') {
    return STATUS_TO_TONE[TaskEntityStatus.Approved];
  }
  if (display === 'Pending' || display === 'Review') {
    return STATUS_TO_TONE[TaskEntityStatus.Open];
  }
  if (display === 'Expired') {
    return 'error';
  }

  return STATUS_TO_TONE[task.status];
};

export const isDataAccessTask = (task: Task): boolean =>
  task.payload !== undefined &&
  (task.payload as DataAccessRequestPayload).accessType !== undefined;

export const getDataAccessPayload = (
  task: Task
): DataAccessRequestPayload | undefined => {
  return task.payload as DataAccessRequestPayload | undefined;
};

const matches = (transitions: Task['availableTransitions'], id: string) =>
  Boolean(transitions?.some((t) => t.id === id));

export const getApproveTransition = (task: Task) =>
  task.availableTransitions?.find((t) => t.id === 'approve');

export const getRejectTransition = (task: Task) =>
  task.availableTransitions?.find((t) => t.id === 'reject');

export const getRevokeTransition = (task: Task) =>
  task.availableTransitions?.find((t) => t.id === 'revoke');

export const canApprove = (task: Task): boolean =>
  matches(task.availableTransitions, 'approve');

export const canReject = (task: Task): boolean =>
  matches(task.availableTransitions, 'reject');

export const canRevoke = (task: Task): boolean =>
  matches(task.availableTransitions, 'revoke');

export const buildResolveBody = (
  transitionId: string,
  resolutionType: TaskResolutionType,
  comment?: string
) => ({
  transitionId,
  resolutionType,
  ...(comment ? { comment } : {}),
});

export const formatDuration = (duration?: string): string => {
  if (!duration) {
    return '-';
  }

  const match = duration.match(/^P(\d+)([DWMY])$/);
  if (!match) {
    return duration;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const plural = value !== 1;

  switch (unit) {
    case 'D':
      return value === 7
        ? '1 Week'
        : value === 14
          ? '2 Weeks'
          : `${value} Day${plural ? 's' : ''}`;
    case 'W':
      return `${value} Week${plural ? 's' : ''}`;
    case 'M':
      return `${value} Month${plural ? 's' : ''}`;
    case 'Y':
      return `${value} Year${plural ? 's' : ''}`;
    default:
      return duration;
  }
};

export const isExpired = (
  startTimestamp?: number,
  duration?: string,
  explicitExpiration?: number
): boolean => {
  const expiry =
    explicitExpiration ?? formatExpirationDate(startTimestamp, duration);

  return Boolean(expiry && expiry < Date.now());
};

export const formatExpirationDate = (
  startTimestamp?: number,
  duration?: string
): number | undefined => {
  if (!duration) {
    return undefined;
  }

  const base = startTimestamp ?? Date.now();
  const match = duration.match(/^P(\d+)([DWMY])$/);
  if (!match) {
    return undefined;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const dayMs = 24 * 60 * 60 * 1000;

  switch (unit) {
    case 'D':
      return base + value * dayMs;
    case 'W':
      return base + value * 7 * dayMs;
    case 'M':
      return base + value * 30 * dayMs;
    case 'Y':
      return base + value * 365 * dayMs;
    default:
      return undefined;
  }
};
