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

import type { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import type { Tag } from '../../generated/entity/classification/tag';

/**
 * A disabled or deleted tag is read-only. Every edit key a widget reads is
 * overridden, not just `EditAll`: an explicit key such as `EditDomains: true`
 * wins over `EditAll` in the permission derivation, so leaving it untouched
 * kept the Domain "+" on a disabled tag.
 */
export const getTagPagePermissions = (
  tag: Tag | undefined,
  permissions: OperationPermission,
  canEditAll: boolean
) => {
  if (!tag) {
    return {
      editTagsPermission: false,
      disabledAwarePermissions: permissions,
    };
  }

  const isEditable = !tag.disabled && !tag.deleted;

  return {
    editTagsPermission: isEditable && canEditAll,
    disabledAwarePermissions: {
      ...permissions,
      EditOwners: isEditable && (canEditAll || permissions.EditOwners),
      EditDomains: isEditable && (canEditAll || permissions.EditDomains),
      EditAll: isEditable && canEditAll,
    },
  };
};
