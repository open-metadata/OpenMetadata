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

import { isEmpty } from 'lodash';
import {
  Task,
  TaskAvailableTransition,
  TaskCategory,
  TaskStatus,
} from '../../../../generated/entity/tasks/task';
import { TaskFormSchema } from '../../../../rest/taskFormSchemasAPI';
import { ResolveTask, TaskResolutionType } from '../../../../rest/tasksAPI';
import {
  applyTaskFormSchemaDefaults,
  getEditableTaskPayload,
  getTaskFormHandlerConfig,
  getTaskResolutionNewValue,
  shouldRequireTaskResolutionValue,
} from '../../../../utils/TaskFormSchemaUtils';
import { isApproveTransition, isRejectTransition } from './taskList.utils';

// A task with no server transitions is only actionable in these states.
const OPEN_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set([
  TaskStatus.Open,
  TaskStatus.InProgress,
  TaskStatus.Pending,
]);

// Not transition ids: a legacy resolve omits `transitionId` (see
// buildResolveBody) and lets the server pick its default transition.
export const LEGACY_APPROVE_ACTION_ID = 'legacy-approve';
export const LEGACY_REJECT_ACTION_ID = 'legacy-reject';

export type TaskActionKind = 'approve' | 'reject' | 'assignee' | 'other';

export interface TaskResolveAction {
  // Transition id for a workflow task; a LEGACY_*_ACTION_ID for a legacy one.
  id: string;
  label: string;
  kind: TaskActionKind;
  requiresComment: boolean;
  // Set only for a server-driven transition; absent ⇒ legacy task.
  transition?: TaskAvailableTransition;
  targetTaskStatus?: TaskStatus;
}

/**
 * Transitions that (re)assign the task — the workflow expects the chosen
 * assignees in the resolve payload, so these open a picker instead of firing.
 */
export const isAssigneeTransition = (
  transition: TaskAvailableTransition
): boolean =>
  transition.id === 'assign' ||
  transition.id === 'reassign' ||
  transition.targetStageId === 'assigned';

const getTransitionKind = (
  transition: TaskAvailableTransition
): TaskActionKind => {
  if (isAssigneeTransition(transition)) {
    return 'assignee';
  }
  if (isApproveTransition(transition)) {
    return 'approve';
  }
  if (isRejectTransition(transition)) {
    return 'reject';
  }

  return 'other';
};

type LegacyResolution = Pick<
  ResolveTask,
  'resolutionType' | 'newValue' | 'payload'
>;

/**
 * Mirrors `TaskTabNew`'s legacy path: approval-type tasks resolve to the
 * handler's approved/rejected sentinel, suggestion types (description, tags, …)
 * to the value being applied.
 */
const buildLegacyResolution = (
  task: Task,
  kind: 'approve' | 'reject',
  schema?: TaskFormSchema
): LegacyResolution => {
  const uiSchema = schema?.uiSchema;
  const handler = getTaskFormHandlerConfig(task, uiSchema);
  const isApprovalHandler =
    handler.type === 'approval' || handler.type === 'feedbackApproval';

  if (kind === 'reject') {
    return {
      resolutionType: TaskResolutionType.Rejected,
      // A rejection applies nothing, so it carries no payload.
      newValue: isApprovalHandler ? handler.rejectedValue : undefined,
    };
  }

  const payload = applyTaskFormSchemaDefaults(
    getEditableTaskPayload(task, uiSchema),
    schema?.formSchema
  );

  return {
    resolutionType: TaskResolutionType.Approved,
    newValue: isApprovalHandler
      ? handler.approvedValue
      : getTaskResolutionNewValue(task, payload, uiSchema),
    payload,
  };
};

const getLegacyActions = (
  task: Task,
  labels: { approve: string; reject: string },
  schema?: TaskFormSchema
): TaskResolveAction[] => {
  if (!OPEN_TASK_STATUSES.has(task.status)) {
    return [];
  }

  // Incidents resolve through their own transition ('resolve' + Completed + a
  // root cause), which a generic approve/reject cannot stand in for.
  const handler = getTaskFormHandlerConfig(task, schema?.uiSchema);
  if (handler.type === 'incident' || task.category === TaskCategory.Incident) {
    return [];
  }

  const reject: TaskResolveAction = {
    id: LEGACY_REJECT_ACTION_ID,
    label: labels.reject,
    kind: 'reject',
    requiresComment: false,
  };

  // A schema-mandated resolution value that resolves empty would be applied as
  // a blank, so drop approve rather than send it.
  const { newValue } = buildLegacyResolution(task, 'approve', schema);
  const canApprove = !(
    shouldRequireTaskResolutionValue(schema?.uiSchema) && isEmpty(newValue)
  );

  return canApprove
    ? [
        {
          id: LEGACY_APPROVE_ACTION_ID,
          label: labels.approve,
          kind: 'approve',
          requiresComment: false,
        },
        reject,
      ]
    : [reject];
};

/**
 * The actions a task exposes: the server's `availableTransitions` when it has
 * them, else the legacy approve/reject the entity page's task tab offers.
 *
 * Pass `schema` where a resolved task form schema is available (single-task
 * views) for custom-schema accuracy; the per-type defaults cover the rest.
 */
export const getTaskResolveActions = (
  task: Task,
  labels: { approve: string; reject: string },
  schema?: TaskFormSchema
): TaskResolveAction[] => {
  const transitions = task.availableTransitions ?? [];

  if (transitions.length > 0) {
    return transitions.map((transition) => ({
      id: transition.id,
      label: transition.label,
      kind: getTransitionKind(transition),
      requiresComment: Boolean(transition.requiresComment),
      transition,
      targetTaskStatus: transition.targetTaskStatus,
    }));
  }

  return getLegacyActions(task, labels, schema);
};

export interface TaskActionInput {
  // The workflow flagged requiresComment; the server 400s without one.
  requiresComment: boolean;
  // An (re)assign, whose assignees travel in the resolve payload.
  requiresAssignee: boolean;
  // Incident resolutions store the reason as testCaseFailureReason.
  requiresRootCause: boolean;
}

/**
 * What an action must collect before it can be resolved. An action that needs
 * nothing fires straight away; anything else opens the action modal.
 */
export const getTaskActionInput = (
  task: Task,
  action: TaskResolveAction
): TaskActionInput => ({
  requiresComment: action.requiresComment,
  requiresAssignee: action.kind === 'assignee',
  requiresRootCause:
    task.category === TaskCategory.Incident && action.requiresComment,
});

export const needsTaskActionInput = (
  task: Task,
  action: TaskResolveAction
): boolean => Object.values(getTaskActionInput(task, action)).some(Boolean);

/**
 * The `POST /tasks/{id}/resolve` body for an action. A workflow action names its
 * transition; a legacy action must NOT — the server validates a named
 * transitionId against `task.availableTransitions` and 400s on anything else, so
 * it sends resolutionType + newValue and lets the server resolve the transition.
 */
export const buildResolveBody = (
  action: TaskResolveAction,
  task: Task,
  extras?: { comment?: string; payload?: Record<string, unknown> },
  schema?: TaskFormSchema
): ResolveTask => {
  const comment = extras?.comment ? { comment: extras.comment } : {};

  if (action.transition) {
    return {
      transitionId: action.transition.id,
      resolutionType: action.transition.resolutionType,
      ...comment,
      ...(extras?.payload ? { payload: extras.payload } : {}),
    };
  }

  const legacy = buildLegacyResolution(
    task,
    action.kind === 'reject' ? 'reject' : 'approve',
    schema
  );

  return {
    ...legacy,
    ...comment,
    ...(extras?.payload
      ? { payload: { ...(legacy.payload ?? {}), ...extras.payload } }
      : {}),
  };
};
