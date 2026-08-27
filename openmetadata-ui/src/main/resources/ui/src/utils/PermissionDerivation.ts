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

import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../generated/entity/policies/policy';
import {
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from './PermissionsUtils';

export interface DerivedPermissionFlags {
  /** ViewBasic || ViewAll */
  hasViewAccess: boolean;
  canEditAll: boolean;
  canEditTags: boolean;
  canEditGlossaryTerms: boolean;
  canEditDescription: boolean;
  canEditDisplayName: boolean;
  canEditCustomFields: boolean;
  canEditOwners: boolean;
  canEditTier: boolean;
  canEditLineage: boolean;
  canEditStatus: boolean;
  canEditSampleData: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canViewAll: boolean;
  canViewBasic: boolean;
  canViewSampleData: boolean;
  canViewQueries: boolean;
  canViewDataProfile: boolean;
  canViewTests: boolean;
  canViewUsage: boolean;
  canViewCustomFields: boolean;
  /**
   * Escape hatch for operations without a named flag. Applies the same
   * prioritization (field → EditAll / ViewAll) and deleted gating as the
   * named flags, so call sites never reimplement policy.
   */
  can: (operation: Operation) => boolean;
}

const isEditOperation = (operation: Operation): boolean =>
  operation.startsWith('Edit');

const isViewOperation = (operation: Operation): boolean =>
  operation.startsWith('View');

/**
 * Single derivation point turning raw OperationPermission into named intent
 * flags. Edit flags are gated by `deleted` (a soft-deleted entity is
 * read-only); view and delete flags are not (delete surfaces restore/purge).
 */
export const getDerivedPermissionFlags = (
  permissions: OperationPermission,
  deleted = false
): DerivedPermissionFlags => {
  // Boolean() is load-bearing: getPrioritizedEditPermission returns
  // permissions[EditAll], which is `undefined` at runtime when neither key
  // exists — the flag type promises boolean, so coerce here, once.
  const edit = (operation: Operation) =>
    Boolean(getPrioritizedEditPermission(permissions, operation)) && !deleted;
  const view = (operation: Operation) =>
    Boolean(getPrioritizedViewPermission(permissions, operation));

  return {
    hasViewAccess: Boolean(
      permissions[Operation.ViewBasic] || permissions[Operation.ViewAll]
    ),
    canEditAll: Boolean(permissions[Operation.EditAll]) && !deleted,
    canEditTags: edit(Operation.EditTags),
    canEditGlossaryTerms: edit(Operation.EditGlossaryTerms),
    canEditDescription: edit(Operation.EditDescription),
    canEditDisplayName: edit(Operation.EditDisplayName),
    canEditCustomFields: edit(Operation.EditCustomFields),
    canEditOwners: edit(Operation.EditOwners),
    canEditTier: edit(Operation.EditTier),
    canEditLineage: edit(Operation.EditLineage),
    canEditStatus: edit(Operation.EditStatus),
    canEditSampleData: edit(Operation.EditSampleData),
    canCreate: Boolean(permissions[Operation.Create]),
    canDelete: Boolean(permissions[Operation.Delete]),
    canViewAll: Boolean(permissions[Operation.ViewAll]),
    canViewBasic: Boolean(permissions[Operation.ViewBasic]),
    canViewSampleData: view(Operation.ViewSampleData),
    canViewQueries: view(Operation.ViewQueries),
    canViewDataProfile: view(Operation.ViewDataProfile),
    canViewTests: view(Operation.ViewTests),
    canViewUsage: view(Operation.ViewUsage),
    canViewCustomFields: view(Operation.ViewCustomFields),
    can: (operation: Operation) => {
      if (isEditOperation(operation)) {
        return edit(operation);
      }
      if (isViewOperation(operation)) {
        return view(operation);
      }

      return Boolean(permissions[operation]);
    },
  };
};
