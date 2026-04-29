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
  DataAccessType,
  Task,
  TaskCategory,
  TaskEntityStatus,
  TaskEntityType,
  TaskPriority,
  TaskResolutionType,
} from '../../rest/tasksAPI';
import {
  buildResolveBody,
  canApprove,
  canReject,
  canRevoke,
  formatExpirationDate,
  getDataAccessPayload,
  getDisplayStatus,
  getDisplayStatusTone,
  isDataAccessTask,
  STATUS_TO_TONE,
} from './DataAccessRequestUtils';

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't-1',
  taskId: 'TASK-001',
  name: 't-1',
  category: TaskCategory.DataAccess,
  type: TaskEntityType.DataAccessRequest,
  status: TaskEntityStatus.Open,
  priority: TaskPriority.Medium,
  ...overrides,
});

describe('DataAccessRequestUtils', () => {
  describe('formatExpirationDate', () => {
    it('returns undefined when duration is missing', () => {
      expect(formatExpirationDate(0, undefined)).toBeUndefined();
    });

    it('returns undefined for malformed duration', () => {
      expect(formatExpirationDate(0, 'not-a-duration')).toBeUndefined();
    });

    it('adds days for P14D', () => {
      const start = new Date('2026-01-01T00:00:00Z').getTime();
      const result = formatExpirationDate(start, 'P14D');

      expect(result).toBe(start + 14 * 86_400_000);
    });

    it('adds weeks for P2W', () => {
      const start = 0;
      const result = formatExpirationDate(start, 'P2W');

      expect(result).toBe(14 * 86_400_000);
    });

    it('adds months for P3M', () => {
      const start = 0;
      const result = formatExpirationDate(start, 'P3M');

      expect(result).toBe(90 * 86_400_000);
    });

    it('adds years for P1Y', () => {
      const start = 0;
      const result = formatExpirationDate(start, 'P1Y');

      expect(result).toBe(365 * 86_400_000);
    });
  });

  describe('STATUS_TO_TONE', () => {
    it('maps every TaskEntityStatus value', () => {
      Object.values(TaskEntityStatus).forEach((status) => {
        expect(STATUS_TO_TONE[status]).toBeDefined();
      });
    });

    it('uses error tone for revoked', () => {
      expect(STATUS_TO_TONE[TaskEntityStatus.Revoked]).toBe('error');
    });
  });

  describe('isDataAccessTask', () => {
    it('returns true when payload has accessType', () => {
      const task = buildTask({
        payload: { accessType: DataAccessType.FullAccess, reason: 'r' },
      });
      expect(isDataAccessTask(task)).toBe(true);
    });

    it('returns false when payload missing or accessType missing', () => {
      expect(isDataAccessTask(buildTask())).toBe(false);
      expect(isDataAccessTask(buildTask({ payload: {} }))).toBe(false);
    });
  });

  describe('getDataAccessPayload', () => {
    it('returns the payload typed as DataAccessRequestPayload', () => {
      const task = buildTask({
        payload: {
          accessType: DataAccessType.ColumnLevel,
          reason: 'q',
          columns: ['t.c1', 't.c2'],
        },
      });
      const payload = getDataAccessPayload(task);

      expect(payload?.accessType).toBe(DataAccessType.ColumnLevel);
      expect(payload?.columns).toEqual(['t.c1', 't.c2']);
    });
  });

  describe('canApprove / canReject / canRevoke', () => {
    it('returns true when matching transition exists', () => {
      const task = buildTask({
        availableTransitions: [
          {
            id: 'approve',
            label: 'A',
            targetStageId: 'approved',
            targetTaskStatus: TaskEntityStatus.Approved,
          },
          {
            id: 'reject',
            label: 'R',
            targetStageId: 'rejected',
            targetTaskStatus: TaskEntityStatus.Rejected,
          },
        ],
      });
      expect(canApprove(task)).toBe(true);
      expect(canReject(task)).toBe(true);
      expect(canRevoke(task)).toBe(false);
    });

    it('returns false when transitions are empty or missing', () => {
      expect(canApprove(buildTask())).toBe(false);
      expect(canApprove(buildTask({ availableTransitions: [] }))).toBe(false);
    });

    it('detects revoke transition', () => {
      const task = buildTask({
        availableTransitions: [
          {
            id: 'revoke',
            label: 'Revoke',
            targetStageId: 'revoked',
            targetTaskStatus: TaskEntityStatus.Revoked,
          },
        ],
      });
      expect(canRevoke(task)).toBe(true);
    });
  });

  describe('getDisplayStatus', () => {
    it('returns workflowStageDisplayName for non-terminal statuses', () => {
      const task = buildTask({
        status: TaskEntityStatus.InProgress,
        workflowStageDisplayName: 'Approved',
      });
      expect(getDisplayStatus(task)).toBe('Approved');
    });

    it('returns the raw status when terminal', () => {
      const task = buildTask({
        status: TaskEntityStatus.Revoked,
        workflowStageDisplayName: 'Approved',
      });
      expect(getDisplayStatus(task)).toBe(TaskEntityStatus.Revoked);
    });

    it('maps Open status to "Pending" label when no stage display name', () => {
      const task = buildTask({ status: TaskEntityStatus.Open });
      expect(getDisplayStatus(task)).toBe('Pending');
    });
  });

  describe('getDisplayStatusTone', () => {
    it('returns success tone when display label is Approved', () => {
      const task = buildTask({
        status: TaskEntityStatus.InProgress,
        workflowStageDisplayName: 'Approved',
      });
      expect(getDisplayStatusTone(task)).toBe('success');
    });

    it('returns warning tone when display label is Pending', () => {
      const task = buildTask({
        status: TaskEntityStatus.Open,
        workflowStageDisplayName: 'Pending',
      });
      expect(getDisplayStatusTone(task)).toBe('warning');
    });
  });

  describe('buildResolveBody', () => {
    it('omits comment when undefined', () => {
      const body = buildResolveBody('approve', TaskResolutionType.Approved);
      expect(body).toEqual({
        transitionId: 'approve',
        resolutionType: TaskResolutionType.Approved,
      });
    });

    it('includes comment when provided', () => {
      const body = buildResolveBody('reject', TaskResolutionType.Rejected, 'no');
      expect(body).toEqual({
        transitionId: 'reject',
        resolutionType: TaskResolutionType.Rejected,
        comment: 'no',
      });
    });
  });
});
