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

import {
  OperationPermission,
  ResourceEntity,
  UIPermission,
} from '../context/PermissionProvider/PermissionProvider.interface';
import {
  Access,
  Permission,
  ResourcePermission,
} from '../generated/entity/policies/accessControl/resourcePermission';
import { Operation } from '../generated/entity/policies/policy';

/**
 *
 * @param operation operation like Edit, Delete
 * @param resourceType Resource type like "bot", "table"
 * @param permissions UIPermission
 * @returns boolean - true/false
 */
export const checkPermission = (
  operation: Operation,
  resourceType: ResourceEntity,
  permissions: UIPermission
) => {
  const allResource = permissions?.all;
  const entityResource = permissions?.[resourceType];
  let hasPermission = false;

  /**
   * If allResource is present then check for permission and return it
   */
  if (allResource && !hasPermission) {
    hasPermission = allResource.All || allResource[operation];
  }

  hasPermission =
    hasPermission || (entityResource && entityResource[operation]);

  return hasPermission;
};

/**
 *
 * @param operation operation like Edit, Delete
 * @param resourceType Resource type like "bot", "table"
 * @param permissions UIPermission
 * @param checkEditAllPermission boolean to check EditALL permission as well
 * @returns boolean - true/false
 */
export const checkPermissionEntityResource = (
  operation: Operation,
  resourceType: ResourceEntity,
  permissions: UIPermission,
  checkEditAllPermission = false
) => {
  const entityResource = permissions?.[resourceType];
  let hasPermission = entityResource && entityResource[operation];

  if (checkEditAllPermission) {
    hasPermission =
      hasPermission || (entityResource && entityResource[Operation.EditAll]);
  }

  return hasPermission;
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

export const userPermissions = {
  /* A util function's that checks if the user has permission to view the resource. */
  hasViewPermissions: (
    resourceEntityType: ResourceEntity,
    permissions: UIPermission
  ) =>
    checkPermission(Operation.ViewBasic, resourceEntityType, permissions) ||
    checkPermission(Operation.ViewAll, resourceEntityType, permissions),
};

export const DEFAULT_ENTITY_PERMISSION = {
  Create: false,
  Delete: false,
  EditAll: false,
  EditCustomFields: false,
  EditDataProfile: false,
  EditDescription: false,
  EditDisplayName: false,
  EditLineage: false,
  EditOwners: false,
  EditQueries: false,
  EditSampleData: false,
  EditTags: false,
  EditTests: false,
  EditTier: false,
  ViewAll: false,
  ViewBasic: false,
  ViewDataProfile: false,
  ViewQueries: false,
  ViewSampleData: false,
  ViewTests: false,
  ViewUsage: false,
} as OperationPermission;

export const LIST_CAP = 1;

export const ALL_TYPE_RESOURCE_LIST = ['all', 'All'];
