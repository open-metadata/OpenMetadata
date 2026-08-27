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

import { has } from 'lodash';
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

  return (
    entityResource?.[operation] ?? allResource?.[operation] ?? allResource?.All
  );
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
 * Translate access level to boolean, with optional handling for conditional grants.
 *
 * @param access - The access level from the backend (Allow, ConditionalAllow, etc.)
 * @param allowConditional - If true, treat ConditionalAllow as true (for resource-level gating).
 *                           If false, ConditionalAllow is false (for entity-level gating).
 * @returns boolean - true if access is allowed, false otherwise
 */
const toAllowedBoolean = (
  access: Access | undefined,
  allowConditional: boolean
): boolean => {
  // Generated Permission.access is optional — absent means not granted.
  if (access === undefined) {
    return false;
  }
  switch (access) {
    case Access.Allow:
      return true;
    case Access.ConditionalAllow:
      // "Depends on the entity" — truthy only for resource-level gating,
      // where the backend cannot evaluate conditions without an entity.
      return allowConditional;
    case Access.ConditionalDeny:
    case Access.Deny:
    case Access.NotAllow:
      return false;
    default: {
      // Compile-time exhaustiveness: new Access members break the build here.
      const unhandled: never = access;

      return Boolean(unhandled);
    }
  }
};

/**
 *
 * @param permission ResourcePermission
 * @param allowConditional If true, treat ConditionalAllow as true. Default false (entity-level strict gating).
 * @returns OperationPermission - {Operation:true/false}
 */
export const getOperationPermissions = (
  permission: ResourcePermission,
  allowConditional = false
): OperationPermission => {
  return permission.permissions.reduce(
    (acc: OperationPermission, curr: Permission) => {
      return {
        ...acc,
        [curr.operation as Operation]: toAllowedBoolean(
          curr.access,
          allowConditional
        ),
      };
    },
    {} as OperationPermission
  );
};

/**
 *
 * @param permissions Take ResourcePermission list
 * @param allowConditional If true, treat ConditionalAllow as true. Default false (entity-level strict gating).
 * @returns UIPermission
 */
export const getUIPermission = (
  permissions: ResourcePermission[],
  allowConditional = false
): UIPermission => {
  return permissions.reduce((acc: UIPermission, curr: ResourcePermission) => {
    return {
      ...acc,
      [curr.resource as ResourceEntity]: getOperationPermissions(
        curr,
        allowConditional
      ),
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

/**
 * Prioritizes field-level edit permissions over EditAll permission
 * @param permissions - The operation permissions object
 * @param fieldEditPermission - The specific field edit permission to check first
 * @returns boolean - true if user has field-specific edit permission or EditAll permission
 */
export const getPrioritizedEditPermission = (
  permissions: OperationPermission,
  fieldEditPermission: Operation
): boolean => {
  if (has(permissions, fieldEditPermission)) {
    return permissions[fieldEditPermission];
  }

  return permissions[Operation.EditAll];
};

/**
 * Prioritizes field-level view permissions over ViewAll permission
 * @param permissions - The operation permissions object
 * @param fieldViewPermission - The specific field view permission to check first
 * @returns boolean - true if user has field-specific view permission or ViewAll permission
 */
export const getPrioritizedViewPermission = (
  permissions: OperationPermission,
  fieldViewPermission: Operation
): boolean => {
  if (has(permissions, fieldViewPermission)) {
    return permissions[fieldViewPermission];
  }

  return permissions[Operation.ViewAll];
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
