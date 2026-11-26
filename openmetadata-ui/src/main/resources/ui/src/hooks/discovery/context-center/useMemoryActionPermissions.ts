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
import { uniq } from 'lodash';
import { useCallback, useMemo } from 'react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { useApplicationStore } from '../../useApplicationStore';
import { useBulkEntityPermissions } from '../../useEntityPermissions/useBulkEntityPermissions';

export interface MemoryActionPermissions {
  canEdit: boolean;
  canDelete: boolean;
}

export const NO_MEMORY_ACTIONS: MemoryActionPermissions = {
  canEdit: false,
  canDelete: false,
};

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
          ),
    [isAdmin, memories, userName]
  );

  const { permissionsByFqn } = useBulkEntityPermissions(
    ResourceEntity.CONTEXT_MEMORY,
    fqns
  );

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
      const { canEditAll, canDelete } = getDerivedPermissionFlags(
        permission,
        memory.deleted
      );

      return { canEdit: canEditAll, canDelete };
    },
    [getPermission]
  );

  return { getMemoryActions };
};
