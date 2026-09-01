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

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import {
  getEntityPermissionByFqn,
  getEntityPermissionById,
} from '../../rest/permissionAPI';
import {
  DerivedPermissionFlags,
  getDerivedPermissionFlags,
} from '../../utils/PermissionDerivation';
import {
  DEFAULT_ENTITY_PERMISSION,
  getOperationPermissions,
} from '../../utils/PermissionsUtils';
import {
  permissionQueryKeys,
  PERMISSION_STALE_TIME,
} from './permissionQueryKeys';

/** FQN as a plain string (primary); `{ id }` for call sites that only hold an entity id. */
export type EntityPermissionIdentifier = string | { id: string };

export interface UseEntityPermissionsOptions {
  /** Soft-deleted entity — edit flags forced false. */
  deleted?: boolean;
  /** Skip fetching (e.g. fqn not resolved yet). Default true. */
  enabled?: boolean;
}

export interface UseEntityPermissionsResult extends DerivedPermissionFlags {
  permissions: OperationPermission;
  isLoading: boolean;
  error: unknown | null;
  refresh: () => Promise<void>;
}

/**
 * The single UI entry point for entity permissions — the frontend mirror of
 * the backend's `authorizer.authorize(subject, operation, resource)`.
 * Components consume named flags; policy math lives in PermissionDerivation;
 * caching, dedup, and invalidation live in React Query (shared with the
 * legacy PermissionProvider path via Task 5).
 */
export const useEntityPermissions = (
  resource: ResourceEntity,
  identifier: EntityPermissionIdentifier,
  options?: UseEntityPermissionsOptions
): UseEntityPermissionsResult => {
  const { deleted = false, enabled = true } = options ?? {};
  const queryClient = useQueryClient();
  const byId = typeof identifier === 'object';
  const key = byId ? identifier.id : identifier;
  const queryKey = byId
    ? permissionQueryKeys.entityById(resource, key)
    : permissionQueryKeys.entity(resource, key);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () =>
      // Entity-level: backend has evaluated conditions — strict Allow only.
      getOperationPermissions(
        await (byId
          ? getEntityPermissionById(resource, key)
          : getEntityPermissionByFqn(resource, key))
      ),
    enabled: enabled && Boolean(key),
    staleTime: PERMISSION_STALE_TIME,
  });

  const permissions = data ?? DEFAULT_ENTITY_PERMISSION;

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
    // invalidateQueries refetches active queries; awaiting it is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, JSON.stringify(queryKey)]);

  const flags = useMemo(
    () => getDerivedPermissionFlags(permissions, deleted),
    [permissions, deleted]
  );

  return useMemo(
    () => ({ ...flags, permissions, isLoading, error: error ?? null, refresh }),
    [flags, permissions, isLoading, error, refresh]
  );
};
