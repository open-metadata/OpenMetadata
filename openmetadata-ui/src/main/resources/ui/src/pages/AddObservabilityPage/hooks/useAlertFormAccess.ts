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
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { useEntityPermissions } from '../../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../../hooks/useFqn';
import { checkPermission } from '../../../utils/PermissionsUtils';

// Create gates the add form, EditAll on the alert gates the edit form.
export const useAlertFormAccess = (isEditMode: boolean) => {
  const { fqn } = useFqn();
  const { permissions } = usePermissionProvider();
  const { canEditAll, isLoading, error, refresh } = useEntityPermissions(
    ResourceEntity.EVENT_SUBSCRIPTION,
    fqn,
    { enabled: isEditMode }
  );

  return {
    hasAccess: isEditMode
      ? canEditAll
      : checkPermission(
          Operation.Create,
          ResourceEntity.EVENT_SUBSCRIPTION,
          permissions
        ),
    isPermissionLoading: isEditMode && isLoading,
    // A failed permission fetch is not a denial; it gets a reload instead.
    permissionError: isEditMode ? error : null,
    refreshPermission: refresh,
  };
};
