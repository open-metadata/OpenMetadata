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
import { useCallback } from 'react';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { getEntityPermissionByFqn } from '../../rest/permissionAPI';
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

export interface UseBulkEntityPermissionsResult {
  permissionsByFqn: Record<string, OperationPermission>;
  flagsByFqn: Record<string, DerivedPermissionFlags>;
  isLoading: boolean;
}

/**
 * Row-level permissions for list views. One cached query per FQN — a row the
 * user already visited as a detail page (same queryKey via
 * permissionQueryKeys.entity) costs nothing. A failed row degrades to
 * no-permission instead of failing the list. When the bulk permissions API
 * (OpenMetadata#30586) lands, swap the per-row queryFn for one batched fetch
 * here — call sites are unaffected.
 *
 * Deliberately asymmetric with useEntityPermissions: no `deleted` option
 * (a list mixes deleted and non-deleted rows, so gating can't be one value
 * for the whole call — apply `deleted` per row via
 * `getDerivedPermissionFlags(permission, row.deleted)` at the call site
 * instead of here), and no `error` (a failed row already degrades silently
 * to DEFAULT_ENTITY_PERMISSION above; surfacing per-row fetch errors, like
 * per-row gating, is the caller's job).
 */
export const useBulkEntityPermissions = (
  resource: ResourceEntity,
  fqns: string[]
): UseBulkEntityPermissionsResult => {
  const validFqns = fqns.filter(Boolean);

  return useQueries({
    queries: validFqns.map((fqn) => ({
      queryKey: permissionQueryKeys.entity(resource, fqn),
      queryFn: async () =>
        getOperationPermissions(await getEntityPermissionByFqn(resource, fqn)),
      staleTime: PERMISSION_STALE_TIME,
    })),
    // combine's output is memoized against the underlying results, so the
    // returned maps are referentially stable across unrelated re-renders.
    combine: useCallback(
      (results: Array<{ data?: OperationPermission; isLoading: boolean }>) => {
        const permissionsByFqn: Record<string, OperationPermission> = {};
        const flagsByFqn: Record<string, DerivedPermissionFlags> = {};
        validFqns.forEach((fqn, index) => {
          const permission = results[index]?.data ?? DEFAULT_ENTITY_PERMISSION;
          permissionsByFqn[fqn] = permission;
          flagsByFqn[fqn] = getDerivedPermissionFlags(permission);
        });

        return {
          permissionsByFqn,
          flagsByFqn,
          isLoading: results.some((result) => result.isLoading),
        };
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [validFqns.join('|')]
    ),
  });
};
