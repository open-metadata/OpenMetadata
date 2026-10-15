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

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../../generated/entity/tasks/task';
import { MY_TASKS_QUERY_KEY } from '../../../../hooks/useMyTasks';
import { resolveTask } from '../../../../rest/tasksAPI';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { INBOX_OPEN_TASK_COUNT_QUERY_KEY } from '../../../discovery/personal-space/inbox.constants';
import {
  buildResolveBody,
  getTaskResolveActions,
  needsTaskActionInput,
} from '../../../discovery/personal-space/InboxPage/taskResolve.utils';

export type BulkDecision = 'approve' | 'reject';

interface BulkResolveInput {
  tasks: Task[];
  decision: BulkDecision;
}

const NEEDS_INPUT = 'needs-input';

/**
 * Approves or rejects every selected task the way the inbox would one at a
 * time — its workflow transition when it has one, its legacy resolution when
 * not. A task whose action needs a comment or a pick is left for the tasks
 * page rather than resolved with the input missing.
 *
 * Settled rather than all-or-nothing: one task closed elsewhere a moment ago
 * must not stop the rest from going through.
 */
export const useBulkResolveTasks = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async ({ tasks, decision }: BulkResolveInput) => {
      const labels = { approve: t('label.approve'), reject: t('label.reject') };
      const results = await Promise.allSettled(
        tasks.map((task) => {
          const action = getTaskResolveActions(task, labels).find(
            (candidate) => candidate.kind === decision
          );

          return action && !needsTaskActionInput(task, action)
            ? resolveTask(task.id, buildResolveBody(action, task))
            : Promise.reject(new Error(NEEDS_INPUT));
        })
      );
      const resolved = results.filter(
        (result) => result.status === 'fulfilled'
      ).length;

      return { resolved, unresolved: results.length - resolved };
    },
    onSuccess: ({ resolved, unresolved }) => {
      if (resolved > 0) {
        showSuccessToast(
          t('message.count-tasks-resolved', { count: resolved })
        );
      }
      if (unresolved > 0) {
        showErrorToast(
          t('message.count-tasks-not-resolved', { count: unresolved })
        );
      }
    },
    onError: (error) => showErrorToast(error as AxiosError),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: MY_TASKS_QUERY_KEY }),
        // The sidebar's inbox badge reads its own count query.
        queryClient.invalidateQueries({
          queryKey: INBOX_OPEN_TASK_COUNT_QUERY_KEY,
        }),
      ]),
  });

  return { isResolving: isPending, resolveTasks: mutateAsync };
};
