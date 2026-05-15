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
import {
  listTasks,
  Task,
  TaskCategory,
  TaskEntityType,
} from '../rest/tasksAPI';
import { isDarApprovalActive } from '../utils/TasksUtils';
import { useApplicationStore } from './useApplicationStore';

interface UseDataAccessRequestParams {
  entityFqn: string | undefined;
  enabled: boolean;
  listenForEvents?: boolean;
}

interface UseDataAccessRequestResult {
  isDarDisabled: boolean;
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
      const res = await listTasks({
        aboutEntity: entityFqn,
        category: TaskCategory.DataAccess,
        type: TaskEntityType.DataAccessRequest,
        createdBy: currentUser.name,
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

  const isDarDisabled = useMemo(() => {
    return existingDarTasks.some((task) => {
      const stage = (
        task.workflowStageDisplayName ??
        task.workflowStageId ??
        ''
      ).toLowerCase();

      if (stage === 'review') {
        return true;
      }

      if (stage === 'approved') {
        const payload = task.payload as
          | { duration?: string; expirationDate?: number }
          | undefined;

        return isDarApprovalActive(
          task.updatedAt ?? task.createdAt,
          payload?.duration,
          payload?.expirationDate
        );
      }

      return false;
    });
  }, [existingDarTasks]);

  return { isDarDisabled, refetch: fetchExistingDar };
};
