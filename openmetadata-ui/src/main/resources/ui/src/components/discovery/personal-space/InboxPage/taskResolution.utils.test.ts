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

// Only the formatter is stubbed (a stable string instead of a locale date); the
// rest of the module stays real because `inbox.utils` pulls its day helpers in
// transitively through the profiler constants.
jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('../../../../utils/date-time/DateTimeUtils'),
  formatDate: (ts: number) => `date-${ts}`,
}));

import {
  Task,
  TaskStatus,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import {
  getTaskResolutionSummary,
  getTaskStatusBadge,
} from './taskResolution.utils';

// The label key is echoed back so assertions read as the key that will render.
const t = (key: string) => key;

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 'task-1',
    name: 'a task',
    status: TaskStatus.Open,
    ...overrides,
  } as Task);

const REJECTED_TASK = makeTask({
  resolution: {
    type: 'Rejected',
    comment: 'test',
    resolvedAt: 1786955635076,
    resolvedBy: { id: 'u1', type: 'user', name: 'harsh.vador' },
  },
  status: TaskStatus.Rejected,
  type: TaskType.DataAccessRequest,
} as Partial<Task>);

describe('getTaskResolutionSummary', () => {
  it('returns nothing while the task is still open', () => {
    expect(getTaskResolutionSummary(makeTask())).toBeUndefined();
  });

  it('returns nothing for a ManualRevoke task, which is awaiting the revoke', () => {
    expect(
      getTaskResolutionSummary(makeTask({ status: TaskStatus.ManualRevoke }))
    ).toBeUndefined();
  });

  it('returns nothing for an approved DAR, which is still awaiting grant', () => {
    // Approved is an OPEN bucket status for a DAR — the request has not ended.
    expect(
      getTaskResolutionSummary(
        makeTask({
          status: TaskStatus.Approved,
          type: TaskType.DataAccessRequest,
        })
      )
    ).toBeUndefined();
  });

  it('summarises a rejection with its reason', () => {
    expect(getTaskResolutionSummary(REJECTED_TASK)).toEqual({
      resolvedBy: { id: 'u1', type: 'user', name: 'harsh.vador' },
      resolvedByName: 'harsh.vador',
      resolvedOn: 'date-1786955635076',
      comment: 'test',
      commentLabelKey: 'label.reason-for-rejection',
      hasResolution: true,
    });
  });

  it.each([
    [TaskStatus.Granted, 'label.comment'],
    [TaskStatus.Completed, 'label.comment'],
    [TaskStatus.Rejected, 'label.reason-for-rejection'],
    [TaskStatus.Revoked, 'label.reason-for-revocation'],
    [TaskStatus.Expired, 'label.comment'],
    [TaskStatus.Cancelled, 'label.comment'],
  ])('labels a %s comment as %s', (status, labelKey) => {
    const summary = getTaskResolutionSummary(
      makeTask({ resolution: { comment: 'why' }, status } as Partial<Task>)
    );

    expect(summary?.commentLabelKey).toBe(labelKey);
  });

  it('falls back to the no-data placeholder when the resolver left no comment', () => {
    const summary = getTaskResolutionSummary(
      makeTask({
        resolution: { type: 'Rejected', comment: '   ' },
        status: TaskStatus.Rejected,
      } as Partial<Task>)
    );

    expect(summary?.comment).toBe('--');
    expect(summary?.hasResolution).toBe(true);
  });

  it('reports no resolution when the workflow closed the task without one', () => {
    // An expiry closes the task server-side without stamping a resolution, so
    // the resolver/date/comment rows stay hidden (the header badge still shows
    // "Expired").
    const summary = getTaskResolutionSummary(
      makeTask({ status: TaskStatus.Expired })
    );

    expect(summary).toMatchObject({ hasResolution: false });
    expect(summary?.resolvedByName).toBeUndefined();
    expect(summary?.resolvedOn).toBeUndefined();
  });
});

describe('getTaskStatusBadge', () => {
  it.each([
    [TaskStatus.Open, 'warning'],
    [TaskStatus.Pending, 'warning'],
    [TaskStatus.InProgress, 'warning'],
    [TaskStatus.ManualRevoke, 'warning'],
    [TaskStatus.Approved, 'success'],
    [TaskStatus.Granted, 'success'],
    [TaskStatus.Completed, 'success'],
    [TaskStatus.Rejected, 'error'],
    [TaskStatus.Revoked, 'error'],
    [TaskStatus.Failed, 'error'],
    [TaskStatus.Expired, 'gray'],
    [TaskStatus.Cancelled, 'gray'],
  ])('tones %s as %s', (status, tone) => {
    // The label comes from the shared getDisplayStatus: the status kebab-cased
    // into a locale key (InProgress → label.in-progress).
    const labelKey = `label.${status
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase()}`;

    expect(getTaskStatusBadge(makeTask({ status }), t)).toEqual({
      label: labelKey,
      tone,
    });
  });

  it('renders nothing for a row that has no status yet', () => {
    expect(getTaskStatusBadge({ id: 'task-1' } as Task, t)).toBeUndefined();
  });
});
