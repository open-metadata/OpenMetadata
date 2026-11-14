/*
 *  Copyright 2022 Collate.
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

import { ReactNode } from 'react';
import { ResourceEntity } from '../../enums/permissions.enum';
import { Operation } from '../../generated/entity/policies/accessControl/resourcePermission';

export type UIPermission = {
  [key in ResourceEntity]: OperationPermission;
};

export type OperationPermission = {
  [key in Operation]: boolean;
};

export type IngestionServicePermission = {
  [key: string]: OperationPermission;
};

export interface PermissionProviderProps {
  children: ReactNode;
}

export interface PermissionContextType {
  permissions: UIPermission;
  /**
   * True while the logged-in user's permissions are being fetched. Once false,
   * `permissions` is final for now, even when empty because the request
   * failed: read this, not emptiness, to tell loading from loaded.
   */
  isPermissionsLoading: boolean;
  getEntityPermission: (
    resource: ResourceEntity,
    entityId: string
  ) => Promise<OperationPermission>;
  getEntityPermissionByFqn: (
    resource: ResourceEntity,
    entityFqn: string
  ) => Promise<OperationPermission>;
  getResourcePermission: (
    resource: ResourceEntity
  ) => Promise<OperationPermission>;
}

// Re-exported because consumers outside this repository import it from this path.
export { ResourceEntity };
