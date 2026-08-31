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
import { EntityStatus } from '../../generated/entity/data/metric';
import { Task } from '../../generated/entity/tasks/task';
import { User } from '../../generated/entity/teams/user';
import {
  isMetricAwaitingApproval,
  metricHasApprovalWorkflow,
  permissionForMetricApproval,
} from './MetricApprovalUtils';

const user = (id: string) => ({ id, name: `user-${id}` } as User);
const ref = (id: string) => ({ id, type: 'user' });

describe('permissionForMetricApproval', () => {
  it('denies approval when there is no open task', () => {
    const result = permissionForMetricApproval(
      { reviewers: [ref('u1')] },
      user('u1'),
      undefined
    );

    expect(result.canApprove).toBe(false);
    expect(result.taskId).toBe('');
  });

  it('allows an assigned user to approve', () => {
    const task = { id: 't1', assignees: [ref('u1')] } as Task;

    const result = permissionForMetricApproval({}, user('u1'), task);

    expect(result.canApprove).toBe(true);
    expect(result.taskId).toBe('t1');
  });

  it('allows a user assigned through a team id or fully qualified name', () => {
    const teamUser = {
      id: 'u1',
      name: 'user-u1',
      teams: [
        {
          fullyQualifiedName: 'Engineering.Data',
          id: 'team-1',
          name: 'Data',
          type: 'team',
        },
      ],
    } as User;

    expect(
      permissionForMetricApproval({}, teamUser, {
        id: 't1',
        assignees: [{ id: 'team-1', type: 'team' }],
      } as Task).canApprove
    ).toBe(true);
    expect(
      permissionForMetricApproval({}, teamUser, {
        id: 't2',
        assignees: [
          {
            fullyQualifiedName: 'Engineering.Data',
            id: 'different-id',
            type: 'team',
          },
        ],
      } as Task).canApprove
    ).toBe(true);
  });

  it('denies a reviewer who was not assigned the task', () => {
    // Assignees are authoritative once present — the workflow narrowed the decision to them.
    const task = { id: 't1', assignees: [ref('u2')] } as Task;

    const result = permissionForMetricApproval(
      { reviewers: [ref('u1')] },
      user('u1'),
      task
    );

    expect(result.canApprove).toBe(false);
  });

  it('falls back to the reviewer list when the task has no assignees', () => {
    const task = { id: 't1', assignees: [] } as unknown as Task;

    const result = permissionForMetricApproval(
      { reviewers: [ref('u1')] },
      user('u1'),
      task
    );

    expect(result.canApprove).toBe(true);
  });

  it('falls back to a reviewer team when the task has no assignees', () => {
    const teamUser = {
      id: 'u1',
      name: 'user-u1',
      teams: [{ id: 'team-1', type: 'team' }],
    } as User;

    const result = permissionForMetricApproval(
      { reviewers: [{ id: 'team-1', type: 'team' }] },
      teamUser,
      { id: 't1', assignees: [] } as unknown as Task
    );

    expect(result.canApprove).toBe(true);
  });

  it('denies a non-reviewer even when the task has no assignees', () => {
    const task = { id: 't1', assignees: [] } as unknown as Task;

    const result = permissionForMetricApproval(
      { reviewers: [ref('u1')] },
      user('someone-else'),
      task
    );

    expect(result.canApprove).toBe(false);
  });

  it('denies an anonymous user', () => {
    const task = { id: 't1', assignees: [ref('u1')] } as Task;

    expect(permissionForMetricApproval({}, undefined, task).canApprove).toBe(
      false
    );
  });
});

describe('isMetricAwaitingApproval', () => {
  it.each([
    [EntityStatus.InReview, true],
    [EntityStatus.Draft, false],
    [EntityStatus.Approved, false],
    [EntityStatus.Rejected, false],
    [undefined, false],
  ])('returns %s -> %s', (status, expected) => {
    expect(isMetricAwaitingApproval(status)).toBe(expected);
  });
});

describe('metricHasApprovalWorkflow', () => {
  it('is true when the metric has reviewers', () => {
    expect(
      metricHasApprovalWorkflow({
        reviewers: [ref('u1')],
        entityStatus: EntityStatus.Approved,
      })
    ).toBe(true);
  });

  it('is true for a metric already moving through review without reviewers loaded', () => {
    expect(
      metricHasApprovalWorkflow({ entityStatus: EntityStatus.InReview })
    ).toBe(true);
  });

  it('is false for an auto-approved metric with no reviewers', () => {
    expect(
      metricHasApprovalWorkflow({
        reviewers: [],
        entityStatus: EntityStatus.Approved,
      })
    ).toBe(false);
  });

  it('is false for an unprocessed legacy metric', () => {
    expect(
      metricHasApprovalWorkflow({ entityStatus: EntityStatus.Unprocessed })
    ).toBe(false);
  });
});
