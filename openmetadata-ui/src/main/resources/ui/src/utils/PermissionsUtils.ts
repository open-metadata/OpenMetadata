/*
 *  Copyright 2021 Collate
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

import {
  OperationPermission,
  ResourceEntity,
  UIPermission,
} from '../components/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../enums/entity.enum';
import {
  Access,
  Permission,
  ResourcePermission,
} from '../generated/entity/policies/accessControl/resourcePermission';
import { Operation } from '../generated/entity/policies/policy';

/**
 * TODO: Remove this method once we have new permission structure everywhere
 */
export const hasPemission = (
  operation: Operation,
  entityType: EntityType,
  permissions: ResourcePermission[]
) => {
  const entityPermission = permissions.find(
    (permission) => permission.resource === entityType
  );

  const currentPermission = entityPermission?.permissions?.find(
    (permission) => permission.operation === operation
  );

  return currentPermission?.access === Access.Allow;
};

/**
 *
 * @param operation operation like Edit, Delete
 * @param resourceType Resource type like "bot", "table"
 * @param permissions UIPermission
 * @returns boolean - true/false
 */
export const checkPemission = (
  operation: Operation,
  resourceType: ResourceEntity,
  permissions: UIPermission
) => {
  const allResource = permissions.all;
  const entityResource = permissions[resourceType];

  /**
   * If allresource is present then check for permission and return it
   */
  if (allResource) {
    return allResource.All || allResource[operation];
  }

  return entityResource[operation];
};

/**
 *
 * @param permission ResourcePermission
 * @returns OperationPermission - {Operation:true/false}
 */
export const getOperationPermissions = (
  permission: ResourcePermission
): OperationPermission => {
  return permission.permissions.reduce(
    (acc: OperationPermission, curr: Permission) => {
      return {
        ...acc,
        [curr.operation as Operation]: curr.access === Access.Allow,
      };
    },
    {} as OperationPermission
  );
};

/**
 *
 * @param permissions Take ResourcePermission list
 * @returns UIPermission
 */
export const getUIPermission = (
  permissions: ResourcePermission[]
): UIPermission => {
  return permissions.reduce((acc: UIPermission, curr: ResourcePermission) => {
    return {
      ...acc,
      [curr.resource as ResourceEntity]: getOperationPermissions(curr),
    };
  }, {} as UIPermission);
};

export const LIST_CAP = 1;
