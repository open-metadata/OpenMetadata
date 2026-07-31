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
import { AxiosError } from 'axios';
import { useCallback, useMemo, useState } from 'react';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../generated/entity/policies/policy';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

/**
 * Owns the PERMISSION concern: the resource-level create/view permissions and
 * the per-row permission map keyed by definition name. The map fans out one
 * {@link getEntityPermissionByFqn} call per row via `Promise.allSettled`,
 * falling back to {@link DEFAULT_ENTITY_PERMISSION} for any rejected lookup.
 * {@link fetchTestDefinitionPermissions} is returned so the data concern can
 * drive it right after it loads a page of definitions.
 */
export const useTestDefinitionRowPermissions = () => {
  const { permissions, getEntityPermissionByFqn } = usePermissionProvider();

  const [testDefinitionPermissions, setTestDefinitionPermissions] = useState<
    Record<string, OperationPermission>
  >({});
  const [permissionLoading, setPermissionLoading] = useState(true);

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

  const fetchTestDefinitionPermissions = useCallback(
    async (definitions: TestDefinition[]) => {
      try {
        setPermissionLoading(true);

        if (!definitions.length) {
          setTestDefinitionPermissions({});

          return;
        }

        const permissionPromises: Promise<OperationPermission>[] =
          definitions.map((def) =>
            getEntityPermissionByFqn(
              ResourceEntity.TEST_DEFINITION,
              def.fullyQualifiedName ?? ''
            )
          );

        const permissionResponses = await Promise.allSettled(
          permissionPromises
        );

        const permissionsMap = definitions.reduce((acc, def, idx) => {
          const response = permissionResponses[idx];

          return {
            ...acc,
            [def.name]:
              response?.status === 'fulfilled'
                ? response.value
                : DEFAULT_ENTITY_PERMISSION,
          };
        }, {} as Record<string, OperationPermission>);

        setTestDefinitionPermissions(permissionsMap);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setPermissionLoading(false);
      }
    },
    [getEntityPermissionByFqn]
  );

  return {
    createPermission,
    viewPermission,
    testDefinitionPermissions,
    permissionLoading,
    fetchTestDefinitionPermissions,
  };
};
