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
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import type { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import type { Task } from '../../../generated/entity/tasks/task';
import { TaskType } from '../../../generated/entity/tasks/task';

const APPROVAL_TASK_TYPES = new Set([
  TaskType.DataAccessRequest,
  TaskType.GlossaryApproval,
  TaskType.RequestApproval,
]);

export const hasMetricTaskUnderlyingPermission = (
  task: Task,
  metricPermissions: Partial<OperationPermission>
) => {
  if (APPROVAL_TASK_TYPES.has(task.type)) {
    return true;
  }

  if (task.type === TaskType.DescriptionUpdate) {
    return Boolean(
      metricPermissions.EditAll || metricPermissions.EditDescription
    );
  }

  if (task.type === TaskType.TagUpdate) {
    return Boolean(metricPermissions.EditAll || metricPermissions.EditTags);
  }

  return Boolean(metricPermissions.EditAll);
};

export const metricTaskPermissionQueryKey = (taskId?: string) => [
  'metric-task-resolution-permission',
  taskId,
];

export const useMetricTaskResolutionPermission = (
  task: Task | undefined,
  metricPermissions: Partial<OperationPermission>
) => {
  const { getEntityPermission } = usePermissionProvider();
  const permissionQuery = useQuery({
    queryKey: metricTaskPermissionQueryKey(task?.id),
    queryFn: () => getEntityPermission(ResourceEntity.TASK, task?.id ?? ''),
    enabled: Boolean(task?.id),
    retry: false,
  });

  return {
    canResolve: Boolean(
      task &&
        permissionQuery.data?.ResolveTask &&
        hasMetricTaskUnderlyingPermission(task, metricPermissions)
    ),
    error: permissionQuery.error,
    isLoading: Boolean(task?.id) && permissionQuery.isPending,
    refetch: permissionQuery.refetch,
  };
};
