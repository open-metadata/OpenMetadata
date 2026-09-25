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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  ResolutionType,
  TaskStatus,
  TaskType,
} from '../generated/entity/tasks/task';
import {
  listTasks,
  ResolveTask,
  resolveTask,
  TaskResolutionType,
} from '../rest/tasksAPI';

export interface UseEntityApprovalTaskParams {
  /**
   * Fully qualified name of the entity under review. The tasks API filters by FQN — an entity
   * link (`<#E::metric::net_sales>`) matches nothing and silently yields no task, which reads as
   * "nothing to approve" rather than as a failed lookup.
   */
  entityFqn: string;
  enabled?: boolean;
}

export const entityApprovalTaskQueryKey = (entityFqn: string) => [
  'entity-approval-task',
  entityFqn,
];

/**
 * The open approval task for an entity, plus approve and reject actions.
 *
 * Entity-agnostic on purpose: it is keyed only by the entity link, so any entity bound to a
 * governance approval workflow can use it without a per-entity copy of the same logic.
 */
export const useEntityApprovalTask = ({
  entityFqn,
  enabled = true,
}: UseEntityApprovalTaskParams) => {
  const queryClient = useQueryClient();

  const {
    data: task,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: entityApprovalTaskQueryKey(entityFqn),
    queryFn: async () => {
      const response = await listTasks({
        aboutEntity: entityFqn,
        type: TaskType.RequestApproval,
        status: TaskStatus.Open,
        fields: 'assignees,availableTransitions,createdBy,resolution,reviewers',
        limit: 1,
      });

      // react-query rejects `undefined` as query data, and "no open task" is the common case —
      // returning undefined would put the query into a permanent error state and retry it.
      return response.data?.[0] ?? null;
    },
    enabled: enabled && Boolean(entityFqn),
  });

  const { mutateAsync, isPending: isResolving } = useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: ResolveTask;
    }) => resolveTask(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: entityApprovalTaskQueryKey(entityFqn),
      });
    },
  });

  const approve = useCallback(
    (taskId: string, comment?: string) => {
      const transitionId = task?.availableTransitions?.find(
        (transition) => transition.resolutionType === ResolutionType.Approved
      )?.id;

      return mutateAsync({
        taskId,
        payload: {
          resolutionType: TaskResolutionType.Approved,
          transitionId,
          comment,
        },
      });
    },
    [mutateAsync, task?.availableTransitions]
  );

  const reject = useCallback(
    (taskId: string, comment: string) => {
      const transitionId = task?.availableTransitions?.find(
        (transition) => transition.resolutionType === ResolutionType.Rejected
      )?.id;

      return mutateAsync({
        taskId,
        payload: {
          resolutionType: TaskResolutionType.Rejected,
          transitionId,
          comment,
        },
      });
    },
    [mutateAsync, task?.availableTransitions]
  );

  return {
    task,
    isPending,
    isResolving,
    error,
    approve,
    refetch,
    reject,
  };
};
