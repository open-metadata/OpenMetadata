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

// Only the HTTP client is stubbed, so the real form-schema utils, schema
// registry and generated enums drive these assertions.
jest.mock('../../../../rest/index', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

import {
  Task,
  TaskAvailableTransition,
  TaskCategory,
  TaskStatus,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { TaskFormSchema } from '../../../../rest/taskFormSchemasAPI';
import { getDefaultTaskFormSchema } from '../../../../utils/TaskFormSchemaUtils';
import {
  buildResolveBody,
  getTaskActionInput,
  getTaskResolveActions,
  LEGACY_APPROVE_ACTION_ID,
  LEGACY_REJECT_ACTION_ID,
  needsTaskActionInput,
} from './taskResolve.utils';

const LABELS = { approve: 'Approve', reject: 'Reject' };

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 'task-1',
    name: 'a task',
    status: TaskStatus.Open,
    ...overrides,
  } as Task);

// The DAR approve transition declares no resolutionType — it advances the
// workflow without closing the task.
const DAR_APPROVE: TaskAvailableTransition = {
  id: 'approve',
  label: 'Approve',
  targetStageId: 'approved',
  targetTaskStatus: TaskStatus.Approved,
};

const DAR_REJECT: TaskAvailableTransition = {
  id: 'reject',
  label: 'Reject',
  requiresComment: true,
  resolutionType: 'Rejected' as TaskAvailableTransition['resolutionType'],
  targetStageId: 'rejected',
  targetTaskStatus: TaskStatus.Rejected,
};

describe('getTaskResolveActions', () => {
  it('maps the server transitions of a workflow task, classifying each kind', () => {
    const actions = getTaskResolveActions(
      makeTask({
        availableTransitions: [
          DAR_APPROVE,
          DAR_REJECT,
          {
            id: 'reassign',
            label: 'Reassign',
            targetStageId: 'assigned',
            targetTaskStatus: TaskStatus.Open,
          },
          {
            id: 'markAsGranted',
            label: 'Mark as granted',
            targetStageId: 'granted',
            targetTaskStatus: TaskStatus.Granted,
          },
        ],
        type: TaskType.DataAccessRequest,
      }),
      LABELS
    );

    expect(
      actions.map(({ id, kind, requiresComment }) => ({
        id,
        kind,
        requiresComment,
      }))
    ).toEqual([
      { id: 'approve', kind: 'approve', requiresComment: false },
      { id: 'reject', kind: 'reject', requiresComment: true },
      { id: 'reassign', kind: 'assignee', requiresComment: false },
      { id: 'markAsGranted', kind: 'other', requiresComment: false },
    ]);
    expect(actions[0].targetTaskStatus).toBe(TaskStatus.Approved);
  });

  it('falls back to a legacy approve/reject pair when the server sent no transitions', () => {
    const actions = getTaskResolveActions(
      makeTask({
        category: TaskCategory.Approval,
        type: TaskType.RequestApproval,
      }),
      LABELS
    );

    expect(actions).toEqual([
      {
        id: LEGACY_APPROVE_ACTION_ID,
        label: 'Approve',
        kind: 'approve',
        requiresComment: false,
      },
      {
        id: LEGACY_REJECT_ACTION_ID,
        label: 'Reject',
        kind: 'reject',
        requiresComment: false,
      },
    ]);
  });

  it.each([TaskStatus.Rejected, TaskStatus.Completed, TaskStatus.Revoked])(
    'offers nothing on a %s task with no transitions',
    (status) => {
      expect(
        getTaskResolveActions(
          makeTask({ category: TaskCategory.Approval, status }),
          LABELS
        )
      ).toEqual([]);
    }
  );

  it('offers no legacy approve/reject for an incident, which resolves through its own transition', () => {
    expect(
      getTaskResolveActions(
        makeTask({
          category: TaskCategory.Incident,
          type: TaskType.TestCaseResolution,
        }),
        LABELS
      )
    ).toEqual([]);
  });

  it('keeps the incident transitions the workflow does provide', () => {
    const actions = getTaskResolveActions(
      makeTask({
        availableTransitions: [
          {
            id: 'resolve',
            label: 'Resolve',
            requiresComment: true,
            resolutionType:
              'Completed' as TaskAvailableTransition['resolutionType'],
            targetStageId: 'resolved',
            targetTaskStatus: TaskStatus.Completed,
          },
        ],
        category: TaskCategory.Incident,
        type: TaskType.TestCaseResolution,
      }),
      LABELS
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      id: 'resolve',
      kind: 'other',
      requiresComment: true,
    });
  });

  it('drops approve when the schema mandates a resolution value the payload lacks', () => {
    const schema = getDefaultTaskFormSchema(
      TaskType.DescriptionUpdate,
      TaskCategory.MetadataUpdate
    );
    const actions = getTaskResolveActions(
      makeTask({
        category: TaskCategory.MetadataUpdate,
        payload: {},
        type: TaskType.DescriptionUpdate,
      }),
      LABELS,
      schema
    );

    expect(actions.map(({ kind }) => kind)).toEqual(['reject']);
  });
});

describe('buildResolveBody', () => {
  const firstAction = (task: Task, schema?: TaskFormSchema) =>
    getTaskResolveActions(task, LABELS, schema);

  it('names the transition of a workflow action and omits a resolutionType the transition does not declare', () => {
    const task = makeTask({
      availableTransitions: [DAR_APPROVE],
      type: TaskType.DataAccessRequest,
    });

    const body = buildResolveBody(firstAction(task)[0], task);

    expect(body).toEqual({
      transitionId: 'approve',
      resolutionType: undefined,
    });
  });

  it('carries the comment and payload of a workflow action', () => {
    const task = makeTask({
      availableTransitions: [DAR_REJECT],
      type: TaskType.DataAccessRequest,
    });

    const body = buildResolveBody(firstAction(task)[0], task, {
      comment: 'not allowed',
      payload: { testCaseFailureReason: 'FalsePositive' },
    });

    expect(body).toEqual({
      transitionId: 'reject',
      resolutionType: 'Rejected',
      comment: 'not allowed',
      payload: { testCaseFailureReason: 'FalsePositive' },
    });
  });

  it('resolves a legacy approval task with the approved sentinel and no transitionId', () => {
    // A fabricated transitionId is what the server rejects with a 400.
    const task = makeTask({
      category: TaskCategory.Approval,
      payload: { proposedChanges: { owners: { added: ['bob'] } } },
      type: TaskType.RequestApproval,
    });

    const body = buildResolveBody(firstAction(task)[0], task);

    expect(body).not.toHaveProperty('transitionId');
    expect(body).toEqual({
      resolutionType: 'Approved',
      newValue: 'approved',
      payload: { proposedChanges: { owners: { added: ['bob'] } } },
    });
  });

  it('resolves a legacy rejection with the rejected sentinel and no payload', () => {
    const task = makeTask({
      category: TaskCategory.Approval,
      payload: { proposedChanges: {} },
      type: TaskType.RequestApproval,
    });

    const body = buildResolveBody(firstAction(task)[1], task, {
      comment: 'no thanks',
    });

    expect(body).toEqual({
      resolutionType: 'Rejected',
      newValue: 'rejected',
      comment: 'no thanks',
    });
  });

  it('applies the suggested description of a legacy description task', () => {
    const schema = getDefaultTaskFormSchema(
      TaskType.DescriptionUpdate,
      TaskCategory.MetadataUpdate
    );
    const task = makeTask({
      category: TaskCategory.MetadataUpdate,
      payload: {
        currentDescription: 'old',
        fieldPath: 'description',
        newDescription: 'the new one',
      },
      type: TaskType.DescriptionUpdate,
    });

    const body = buildResolveBody(
      firstAction(task, schema)[0],
      task,
      undefined,
      schema
    );

    expect(body.transitionId).toBeUndefined();
    expect(body.resolutionType).toBe('Approved');
    expect(body.newValue).toBe('the new one');
  });

  it('applies the merged tag set of a legacy tag task', () => {
    const schema = getDefaultTaskFormSchema(
      TaskType.TagUpdate,
      TaskCategory.MetadataUpdate
    );
    const task = makeTask({
      category: TaskCategory.MetadataUpdate,
      payload: {
        currentTags: [{ tagFQN: 'PII.Sensitive' }],
        fieldPath: 'tags',
        tagsToAdd: [{ tagFQN: 'Tier.Tier1' }],
        tagsToRemove: [{ tagFQN: 'PII.Sensitive' }],
      },
      type: TaskType.TagUpdate,
    });

    const body = buildResolveBody(
      firstAction(task, schema)[0],
      task,
      undefined,
      schema
    );

    expect(body.transitionId).toBeUndefined();
    expect(JSON.parse(body.newValue as string)).toEqual([
      { tagFQN: 'Tier.Tier1' },
    ]);
  });

  it('merges extra payload fields over the echoed legacy payload', () => {
    const task = makeTask({
      category: TaskCategory.Approval,
      payload: { proposedChanges: {} },
      type: TaskType.RequestApproval,
    });

    const body = buildResolveBody(firstAction(task)[0], task, {
      payload: { extra: true },
    });

    expect(body.payload).toEqual({ proposedChanges: {}, extra: true });
  });
});

describe('getTaskActionInput', () => {
  const workflowTask = (
    transition: TaskAvailableTransition,
    overrides: Partial<Task> = {}
  ) =>
    makeTask({
      availableTransitions: [transition],
      ...overrides,
    } as Partial<Task>);

  it('needs nothing for a plain advance, so it fires without a modal', () => {
    const task = workflowTask({
      id: 'markAsGranted',
      label: 'Mark as Granted',
      targetStageId: 'granted',
      targetTaskStatus: TaskStatus.Granted,
    });
    const [action] = getTaskResolveActions(task, LABELS);

    expect(getTaskActionInput(task, action)).toEqual({
      requiresComment: false,
      requiresAssignee: false,
      requiresRootCause: false,
    });
    expect(needsTaskActionInput(task, action)).toBe(false);
  });

  it('needs the comment the workflow demands', () => {
    const task = workflowTask(DAR_REJECT);
    const [action] = getTaskResolveActions(task, LABELS);

    expect(getTaskActionInput(task, action)).toMatchObject({
      requiresComment: true,
      requiresRootCause: false,
    });
    expect(needsTaskActionInput(task, action)).toBe(true);
  });

  it('needs an assignee for an assign transition', () => {
    const task = workflowTask({
      id: 'reassign',
      label: 'Reassign',
      targetStageId: 'assigned',
      targetTaskStatus: TaskStatus.Open,
    });
    const [action] = getTaskResolveActions(task, LABELS);

    expect(getTaskActionInput(task, action)).toMatchObject({
      requiresAssignee: true,
    });
    expect(needsTaskActionInput(task, action)).toBe(true);
  });

  it('adds the root cause for an incident resolve', () => {
    const task = workflowTask(
      {
        id: 'resolve',
        label: 'Resolve',
        requiresComment: true,
        targetStageId: 'resolved',
        targetTaskStatus: TaskStatus.Completed,
      },
      { category: TaskCategory.Incident }
    );
    const [action] = getTaskResolveActions(task, LABELS);

    expect(getTaskActionInput(task, action)).toEqual({
      requiresComment: true,
      requiresAssignee: false,
      requiresRootCause: true,
    });
  });
});
