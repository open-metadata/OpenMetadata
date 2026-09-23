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

import { ResourceEntity } from '../../enums/permissions.enum';

import { ReactNode } from 'react';
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
