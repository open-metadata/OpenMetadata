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

import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { useEntityPermissions } from '../../../hooks/useEntityPermissions/useEntityPermissions';
import { AlertDetailsPermissions } from '../AlertDetailsPage.interface';

export function useAlertDetailsPermissions(fqn: string) {
  const {
    hasViewAccess,
    canEditAll,
    canEditOwners,
    canEditDescription,
    canDelete,
    isLoading,
  } = useEntityPermissions(ResourceEntity.EVENT_SUBSCRIPTION, fqn, {
    enabled: Boolean(fqn),
  });

  const permissions: AlertDetailsPermissions = {
    // Bare OR (ViewBasic || ViewAll) — unchanged from the old derivation,
    // both are a plain OR here (unlike the edit flags below).
    viewPermission: hasViewAccess,
    editPermission: canEditAll,
    // INTENTIONAL BEHAVIOR CHANGE (Task 9): the old derivation was a bare
    // `EditAll || EditOwners` / `EditAll || EditDescription` OR, which let a
    // blanket EditAll grant override an explicit per-field deny. The fold
    // moves to getDerivedPermissionFlags' prioritized derivation — an
    // explicit false on the field-specific key now wins over EditAll, same
    // as the canViewBasic precedent documented in PermissionDerivation.ts
    // (a raw/bare-OR read there would regress a real "field key present,
    // explicitly denied" case). See useAlertDetailsPermissions.test.tsx's
    // "intentional change" describe block for the characterization evidence
    // (RED against the old bare-OR code, green here).
    editOwnersPermission: canEditOwners,
    editDescriptionPermission: canEditDescription,
    deletePermission: canDelete,
  };

  return {
    ...permissions,
    loading: isLoading,
  };
}
