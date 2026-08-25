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
import { useQuery } from '@tanstack/react-query';
import { METRIC_APPROVAL_WORKFLOW_DEFINITION_NAME } from '../../../constants/Metric.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  ResolutionType,
  Task,
  TaskType,
} from '../../../generated/entity/tasks/task';
import { WorkflowInstance } from '../../../generated/governance/workflows/workflowInstance';
import {
  WorkflowInstanceState,
  WorkflowStatus,
} from '../../../generated/governance/workflows/workflowInstanceState';
import { listTasks } from '../../../rest/tasksAPI';
import {
  getWorkflowInstancesForApplication,
  getWorkflowInstanceStateById,
} from '../../../rest/workflowAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';

const HISTORY_PAGE_SIZE = 100;

export interface MetricApprovalHistoryItem {
  actor?: string;
  id: string;
  isAutomatic: boolean;
  label: string;
  note?: string;
  outcome?: 'approved' | 'rejected' | 'rollback';
  status: string;
  timestamp: number;
}

export const metricApprovalHistoryQueryKey = (metricFqn: string) => [
  'metric-approval-history',
  metricFqn,
];

const getWorkflowOutcome = (
  name?: string
): MetricApprovalHistoryItem['outcome'] => {
  const normalizedName = name?.toLocaleLowerCase() ?? '';
  let outcome: MetricApprovalHistoryItem['outcome'];

  if (normalizedName.includes('rollback')) {
    outcome = 'rollback';
  } else if (normalizedName.includes('reject')) {
    outcome = 'rejected';
  } else if (normalizedName.includes('approve')) {
    outcome = 'approved';
  }

  return outcome;
};

export const getMetricApprovalOutcome = (
  history?: MetricApprovalHistoryItem[]
): MetricApprovalHistoryItem['outcome'] =>
  history?.find((item) => item.outcome)?.outcome;

const getAllWorkflowInstances = async (entityLink: string, endTs: number) => {
  const data: WorkflowInstance[] = [];
  const seenOffsets = new Set<string>();
  let offset: string | undefined;
  do {
    const response = await getWorkflowInstancesForApplication({
      endTs,
      entityLink,
      limit: HISTORY_PAGE_SIZE,
      offset,
      startTs: 0,
      workflowDefinitionName: METRIC_APPROVAL_WORKFLOW_DEFINITION_NAME,
    });
    data.push(...(response.data ?? []));
    offset = response.paging.after;
    if (offset && seenOffsets.has(offset)) {
      break;
    }
    if (offset) {
      seenOffsets.add(offset);
    }
  } while (offset);

  return data;
};

const getAllWorkflowStates = async (instanceId: string, endTs: number) => {
  const data: WorkflowInstanceState[] = [];
  const seenOffsets = new Set<string>();
  let offset: string | undefined;
  do {
    const response = await getWorkflowInstanceStateById(
      METRIC_APPROVAL_WORKFLOW_DEFINITION_NAME,
      instanceId,
      { endTs, limit: HISTORY_PAGE_SIZE, offset, startTs: 0 }
    );
    data.push(...response.data);
    offset = response.paging.after;
    if (offset && seenOffsets.has(offset)) {
      break;
    }
    if (offset) {
      seenOffsets.add(offset);
    }
  } while (offset);

  return data;
};

const getAllApprovalTasks = async (metricFqn: string) => {
  const data: Task[] = [];
  const seenCursors = new Set<string>();
  let after: string | undefined;
  do {
    const response = await listTasks({
      aboutEntity: metricFqn,
      after,
      fields: 'assignees,availableTransitions,createdBy,resolution,reviewers',
      limit: HISTORY_PAGE_SIZE,
      type: TaskType.RequestApproval,
    });
    data.push(...(response.data ?? []));
    after = response.paging.after;
    if (after && seenCursors.has(after)) {
      break;
    }
    if (after) {
      seenCursors.add(after);
    }
  } while (after);

  return data;
};

export const useMetricApprovalHistory = (metricFqn?: string) =>
  useQuery({
    queryKey: metricApprovalHistoryQueryKey(metricFqn ?? ''),
    queryFn: async (): Promise<MetricApprovalHistoryItem[]> => {
      if (!metricFqn) {
        return [];
      }
      const endTs = Date.now();
      const entityLink = getEntityFeedLink(EntityType.METRIC, metricFqn);
      const [instances, tasks] = await Promise.all([
        getAllWorkflowInstances(entityLink, endTs),
        getAllApprovalTasks(metricFqn),
      ]);
      const stateResponses = await Promise.all(
        instances.flatMap((instance) =>
          instance.id ? [getAllWorkflowStates(instance.id, endTs)] : []
        )
      );
      const workflowItems = stateResponses.flatMap((states) =>
        states.map((state, index) => ({
          id:
            state.id ??
            `${state.workflowInstanceId ?? 'workflow'}-${
              state.timestamp ?? index
            }`,
          isAutomatic: (state.stage?.tasks?.length ?? 0) === 0,
          label:
            state.stage?.displayName ?? state.stage?.name ?? state.status ?? '',
          outcome: getWorkflowOutcome(
            state.stage?.name ?? state.stage?.displayName
          ),
          status: state.status ?? WorkflowStatus.Running,
          timestamp: state.timestamp ?? state.stage?.startedAt ?? 0,
        }))
      );
      const taskItems = tasks.map((task) => ({
        actor:
          task.resolution?.resolvedBy?.displayName ??
          task.resolution?.resolvedBy?.name ??
          task.createdBy.displayName ??
          task.createdBy.name,
        id: `task-${task.id}`,
        isAutomatic: [
          ResolutionType.AutoApproved,
          ResolutionType.AutoRejected,
        ].includes(task.resolution?.type ?? ResolutionType.Completed),
        label: task.displayName ?? task.name,
        note: task.resolution?.comment,
        outcome:
          task.resolution?.type === ResolutionType.Approved
            ? ('approved' as const)
            : task.resolution?.type === ResolutionType.Rejected
            ? ('rejected' as const)
            : undefined,
        status: task.resolution?.type ?? task.status,
        timestamp:
          task.resolution?.resolvedAt ?? task.updatedAt ?? task.createdAt ?? 0,
      }));

      return [...workflowItems, ...taskItems].sort(
        (left, right) => right.timestamp - left.timestamp
      );
    },
    enabled: Boolean(metricFqn),
  });
