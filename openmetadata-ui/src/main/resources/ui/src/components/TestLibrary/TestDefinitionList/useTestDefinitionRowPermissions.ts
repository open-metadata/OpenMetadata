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
import { useCallback, useMemo, useState } from 'react';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../generated/entity/policies/policy';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { useBulkEntityPermissions } from '../../../hooks/useEntityPermissions/useBulkEntityPermissions';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../../utils/PermissionsUtils';

/**
 * Owns the PERMISSION concern: the resource-level create/view permissions
 * (still a direct {@link checkPermission} read off the provider's cached
 * `permissions` object — those never had a per-row identifier to key a
 * {@link useBulkEntityPermissions} query on) and the per-row permission map
 * keyed by definition name. The row map is driven by
 * {@link useBulkEntityPermissions}, one cached query per FQN, re-keyed here
 * from FQN to `name` — {@link fetchTestDefinitionPermissions} is an
 * imperative callback only in the sense that it stores the definitions the
 * data concern just loaded; the actual fetch (and its caching/dedup) is owned
 * by the shared hook. A row missing a `fullyQualifiedName` has no identifier
 * to query and degrades straight to {@link DEFAULT_ENTITY_PERMISSION} without
 * a network call (useBulkEntityPermissions filters falsy FQNs out of its
 * query list).
 */
export const useTestDefinitionRowPermissions = () => {
  const { permissions } = usePermissionProvider();

  const [definitionsForPermissions, setDefinitionsForPermissions] = useState<
    TestDefinition[]
  >([]);
  // useBulkEntityPermissions reports isLoading:false for an empty fqn list —
  // correct once a fetch has actually run, but wrong before the first
  // fetchTestDefinitionPermissions call (old code started permissionLoading
  // true). hasFetched preserves that initial-loading semantic.
  const [hasFetched, setHasFetched] = useState(false);

  const createPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        ResourceEntity.TEST_DEFINITION,
        permissions
      ),
    [permissions]
  );

  const viewPermission = useMemo(
    () =>
      checkPermission(
        Operation.ViewBasic,
        ResourceEntity.TEST_DEFINITION,
        permissions
      ) ||
      checkPermission(
        Operation.ViewAll,
        ResourceEntity.TEST_DEFINITION,
        permissions
      ),
    [permissions]
  );

  const fqns = useMemo(
    () => definitionsForPermissions.map((def) => def.fullyQualifiedName ?? ''),
    [definitionsForPermissions]
  );

  const { permissionsByFqn, isLoading: isBulkLoading } =
    useBulkEntityPermissions(ResourceEntity.TEST_DEFINITION, fqns);

  const testDefinitionPermissions = useMemo(
    () =>
      definitionsForPermissions.reduce<Record<string, OperationPermission>>(
        (acc, def) => {
          const fqn = def.fullyQualifiedName ?? '';
          acc[def.name] = permissionsByFqn[fqn] ?? DEFAULT_ENTITY_PERMISSION;

          return acc;
        },
        {}
      ),
    [definitionsForPermissions, permissionsByFqn]
  );

  const permissionLoading = !hasFetched || isBulkLoading;

  /**
   * CONTRACT CHANGE from the pre-fold implementation: the returned promise
   * now resolves once `definitions` have been STORED (synchronously, on the
   * next tick), NOT once permissions have actually been fetched. The real
   * fetch — and its resolution — is owned by {@link useBulkEntityPermissions}
   * and happens asynchronously afterward, driven by the `fqns` derived from
   * this stored state; `testDefinitionPermissions`/`permissionLoading` are
   * what observe that fetch completing, not this promise. The pre-fold
   * version awaited the actual Promise.allSettled fetch here, so a caller
   * that `await`s this call expecting fresh `testDefinitionPermissions`
   * immediately afterward will NOT get them — the current sole caller
   * (`useTestDefinitionData.ts`'s `fetchTestDefinitions`) is fire-and-forget
   * (`fetchTestDefinitionPermissions(data)`, not awaited) and is therefore
   * unaffected, but a future caller that awaits this must not assume the
   * fetch has completed when it resolves.
   */
  const fetchTestDefinitionPermissions = useCallback(
    async (definitions: TestDefinition[]) => {
      setDefinitionsForPermissions(definitions);
      setHasFetched(true);
    },
    []
  );

  return {
    createPermission,
    viewPermission,
    testDefinitionPermissions,
    permissionLoading,
    fetchTestDefinitionPermissions,
  };
};
