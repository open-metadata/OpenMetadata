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
import { useQueries } from '@tanstack/react-query';
import { uniq } from 'lodash';
import { useCallback, useMemo } from 'react';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import { getEntityPermissionByFqn } from '../../../rest/permissionAPI';
import { getOperationPermissions } from '../../../utils/PermissionsUtils';
import { useApplicationStore } from '../../useApplicationStore';

export interface MemoryActionPermissions {
  canEdit: boolean;
  canDelete: boolean;
}

export const NO_MEMORY_ACTIONS: MemoryActionPermissions = {
  canEdit: false,
  canDelete: false,
};

export const memoryPermissionQueryKey = (fqn: string) =>
  ['permissions', 'entity', ResourceEntity.CONTEXT_MEMORY, fqn] as const;

const isOwnedBy = (
  userName: string | undefined,
  memory?: ContextMemory
): memory is ContextMemory =>
  Boolean(userName && memory?.owners?.some((owner) => owner.name === userName));

/**
 * Edit and Delete for each memory the page shows, from that memory's own
 * permission. The resource-level answer cannot carry them for a non-admin:
 * `OrganizationPolicy-Owner-Rule` grants them through `isOwner()`, which the
 * server reports as conditional until it evaluates a specific memory. So a
 * non-admin's memories are looked up one by one, but only the ones they own,
 * because the page keeps Edit and Delete to the owner or an admin. An admin is
 * allowed every operation without a policy check, so the resource level is
 * already their answer and needs no lookup. Until a lookup answers, or when it
 * fails, the memory has neither action.
 */
export const useMemoryActionPermissions = (
  memories: Array<ContextMemory | undefined>,
  resourcePermission: OperationPermission
) => {
  const { currentUser } = useApplicationStore();
  const isAdmin = Boolean(currentUser?.isAdmin);
  const userName = currentUser?.name;

  const fqns = useMemo(
    () =>
      isAdmin
        ? []
        : uniq(
            memories
              .filter((memory): memory is ContextMemory =>
                isOwnedBy(userName, memory)
              )
              .map((memory) => memory.fullyQualifiedName ?? '')
              .filter(Boolean)
          ),
    [isAdmin, memories, userName]
  );

  const permissionsByFqn = useQueries({
    queries: fqns.map((fqn) => ({
      queryKey: memoryPermissionQueryKey(fqn),
      queryFn: async () =>
        getOperationPermissions(
          await getEntityPermissionByFqn(ResourceEntity.CONTEXT_MEMORY, fqn)
        ),
    })),
    combine: useCallback(
      (results: Array<{ data?: OperationPermission }>) =>
        Object.fromEntries(
          fqns.map((fqn, index) => [fqn, results[index]?.data])
        ) as Record<string, OperationPermission | undefined>,
      [fqns]
    ),
  });

  const getPermission = useCallback(
    (memory: ContextMemory): OperationPermission | undefined => {
      if (isAdmin) {
        return resourcePermission;
      }

      return isOwnedBy(userName, memory)
        ? permissionsByFqn[memory.fullyQualifiedName ?? '']
        : undefined;
    },
    [isAdmin, userName, permissionsByFqn, resourcePermission]
  );

  const getMemoryActions = useCallback(
    (memory?: ContextMemory): MemoryActionPermissions => {
      const permission = memory && getPermission(memory);
      if (!memory || !permission) {
        return NO_MEMORY_ACTIONS;
      }

      return {
        canEdit: Boolean(permission.EditAll) && !memory.deleted,
        canDelete: Boolean(permission.Delete),
      };
    },
    [getPermission]
  );

  return { getMemoryActions };
};
