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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { AlertDetailsPermissions } from '../AlertDetailsPage.interface';

export function useAlertDetailsPermissions(fqn: string) {
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const getEntityPermissionByFqnRef = useRef(getEntityPermissionByFqn);
  const [loading, setLoading] = useState(false);
  const [alertPermission, setAlertPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  useEffect(() => {
    getEntityPermissionByFqnRef.current = getEntityPermissionByFqn;
  }, [getEntityPermissionByFqn]);

  const permissions: AlertDetailsPermissions = useMemo(
    () => ({
      viewPermission: alertPermission.ViewAll || alertPermission.ViewBasic,
      editPermission: alertPermission.EditAll,
      editOwnersPermission:
        alertPermission.EditAll || alertPermission.EditOwners,
      editDescriptionPermission:
        alertPermission.EditAll || alertPermission.EditDescription,
      deletePermission: alertPermission.Delete,
    }),
    [alertPermission]
  );

  const fetchResourcePermission = useCallback(async () => {
    try {
      setLoading(true);
      if (fqn) {
        const searchIndexPermission = await getEntityPermissionByFqnRef.current(
          ResourceEntity.EVENT_SUBSCRIPTION,
          fqn
        );

        setAlertPermission(searchIndexPermission);
      }
    } finally {
      setLoading(false);
    }
  }, [fqn]);

  useEffect(() => {
    fetchResourcePermission();
  }, [fetchResourcePermission]);

  return {
    ...permissions,
    loading,
  };
}
