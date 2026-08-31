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
import { EntityStatus, Metric } from '../../generated/entity/data/metric';
import { Task } from '../../generated/entity/tasks/task';
import { User } from '../../generated/entity/teams/user';

export interface MetricApprovalPermission {
  /** Whether the current user may act on the approval task. */
  canApprove: boolean;
  /** Id of the open approval task, or an empty string when there is none. */
  taskId: string;
}

/**
 * Decides whether the signed-in user may approve or reject a metric.
 *
 * When the task carries explicit assignees they are authoritative — the workflow narrowed the
 * decision to those people, and a reviewer who was not assigned should not be able to bypass that.
 * Only when the task has no assignees at all does membership of the metric's reviewer list stand in
 * for one, which is what keeps a task created before reviewers were resolved from being unactionable.
 */
export const permissionForMetricApproval = (
  metric: Pick<Metric, 'reviewers'>,
  currentUser: User | undefined,
  task: Task | undefined
): MetricApprovalPermission => {
  const currentUserIdentifiers = new Set(
    [
      currentUser?.id,
      currentUser?.name,
      currentUser?.fullyQualifiedName,
      ...(currentUser?.teams ?? []).flatMap((team) => [
        team.id,
        team.name,
        team.fullyQualifiedName,
      ]),
    ].filter((identifier): identifier is string => Boolean(identifier))
  );
  const matchesCurrentUserOrTeam = (reference: {
    fullyQualifiedName?: string;
    id: string;
    name?: string;
  }) =>
    [reference.id, reference.name, reference.fullyQualifiedName].some(
      (identifier) =>
        Boolean(identifier && currentUserIdentifiers.has(identifier))
    );
  const isReviewer = metric.reviewers?.some(matchesCurrentUserOrTeam);
  const isTaskAssignee = task?.assignees?.some(matchesCurrentUserOrTeam);
  const hasTaskAssignees = Boolean(task?.assignees?.length);

  const canApprove = hasTaskAssignees
    ? Boolean(isTaskAssignee)
    : Boolean(task && (isTaskAssignee || isReviewer));

  return { canApprove, taskId: task?.id ?? '' };
};

/**
 * Approve/reject controls only make sense while the metric is actually awaiting a decision.
 */
export const isMetricAwaitingApproval = (status?: EntityStatus): boolean =>
  status === EntityStatus.InReview;

/**
 * Metrics with reviewers expose the approval tab. A workflow status also keeps the tab available
 * after reviewers change so an existing decision or rollback timeline remains accessible.
 */
export const metricHasApprovalWorkflow = (
  metric: Pick<Metric, 'reviewers' | 'entityStatus'>
): boolean =>
  (metric.reviewers?.length ?? 0) > 0 ||
  (metric.entityStatus !== undefined &&
    metric.entityStatus !== EntityStatus.Unprocessed &&
    metric.entityStatus !== EntityStatus.Approved);
