/*
 *  Copyright 2025 Collate.
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Task } from '../generated/entity/tasks/task';
import {
  DarWorkflowStage,
  listDataAccessRequests,
  TaskEntityStatus,
  TaskStatusGroup,
} from '../rest/tasksAPI';
import { isDarApprovalActive } from '../utils/TaskActionUtils';
import { useApplicationStore } from './useApplicationStore';

interface UseDataAccessRequestParams {
  entityFqn: string | undefined;
  enabled: boolean;
  listenForEvents?: boolean;
}

interface UseDataAccessRequestResult {
  isDarDisabled: boolean;
  isDarAwaitingGrant: boolean;
  isDarGranted: boolean;
  refetch: () => void;
}

export const useDataAccessRequest = ({
  entityFqn,
  enabled,
  listenForEvents = false,
}: UseDataAccessRequestParams): UseDataAccessRequestResult => {
  const { currentUser } = useApplicationStore();
  const [existingDarTasks, setExistingDarTasks] = useState<Task[]>([]);

  const fetchExistingDar = useCallback(async () => {
    if (!entityFqn || !currentUser?.name || !enabled) {
      setExistingDarTasks([]);

      return;
    }

    try {
      const res = await listDataAccessRequests({
        dataset: entityFqn,
        requestedBy: currentUser.fullyQualifiedName ?? currentUser.name,
        statusGroup: TaskStatusGroup.Active,
        fields: 'about,resolution',
        limit: 10,
      });
      setExistingDarTasks(res.data ?? []);
    } catch {
      setExistingDarTasks([]);
    }
  }, [entityFqn, currentUser?.name, enabled]);

  useEffect(() => {
    fetchExistingDar();
  }, [fetchExistingDar]);

  useEffect(() => {
    if (!listenForEvents) {
      return;
    }

    const handler = () => fetchExistingDar();
    globalThis.addEventListener('dar-task-created', handler);
    globalThis.addEventListener('dar-task-resolved', handler);

    return () => {
      globalThis.removeEventListener('dar-task-created', handler);
      globalThis.removeEventListener('dar-task-resolved', handler);
    };
  }, [fetchExistingDar, listenForEvents]);

  const isDarDisabled = useMemo(
    () =>
      existingDarTasks.some((task) => {
        // Prefer the persisted status enum (Approved/Granted carry the workflow
        // semantics directly); fall back to the workflow stage name for any task
        // that pre-dates the explicit status setter and only has stage metadata.
        const stage = (
          task.workflowStageDisplayName ??
          task.workflowStageId ??
          ''
        ).toLowerCase();
        const isApproved =
          task.status === TaskEntityStatus.Approved ||
          stage === DarWorkflowStage.Approved;
        const isGranted =
          task.status === TaskEntityStatus.Granted ||
          stage === DarWorkflowStage.Granted;

        if (isApproved || isGranted) {
          const payload = task.payload as
            | { duration?: string; expirationDate?: number }
            | undefined;

          return isDarApprovalActive(
            task.approvedAt ?? task.updatedAt ?? task.createdAt,
            payload?.duration,
            payload?.expirationDate
          );
        }

        // The fetch is scoped to statusGroup=active, so any remaining task here
        // is Open/InProgress/Pending (or stage=review) — still in-flight, block
        // a duplicate request.
        return true;
      }),
    [existingDarTasks]
  );

  const isDarAwaitingGrant = useMemo(
    () =>
      existingDarTasks.some((task) => {
        const stage = (
          task.workflowStageDisplayName ??
          task.workflowStageId ??
          ''
        ).toLowerCase();
        const isApproved =
          task.status === TaskEntityStatus.Approved ||
          (stage === DarWorkflowStage.Approved &&
            task.status !== TaskEntityStatus.Granted);

        if (!isApproved) {
          return false;
        }

        // Mirror the isDarApprovalActive gate used by isDarDisabled. Without this an
        // expired approval would still show the "awaiting grant" banner even though
        // isDarDisabled returns false (button enabled), leaving a contradictory UX.
        const payload = task.payload as
          | { duration?: string; expirationDate?: number }
          | undefined;

        return isDarApprovalActive(
          task.approvedAt ?? task.updatedAt ?? task.createdAt,
          payload?.duration,
          payload?.expirationDate
        );
      }),
    [existingDarTasks]
  );

  const isDarGranted = useMemo(
    () =>
      existingDarTasks.some((task) => {
        const stage = (
          task.workflowStageDisplayName ??
          task.workflowStageId ??
          ''
        ).toLowerCase();
        const isGranted =
          task.status === TaskEntityStatus.Granted ||
          stage === DarWorkflowStage.Granted;

        if (!isGranted) {
          return false;
        }

        const payload = task.payload as
          | { duration?: string; expirationDate?: number }
          | undefined;

        return isDarApprovalActive(
          task.approvedAt ?? task.updatedAt ?? task.createdAt,
          payload?.duration,
          payload?.expirationDate
        );
      }),
    [existingDarTasks]
  );

  return {
    isDarDisabled,
    isDarAwaitingGrant,
    isDarGranted,
    refetch: fetchExistingDar,
  };
};
