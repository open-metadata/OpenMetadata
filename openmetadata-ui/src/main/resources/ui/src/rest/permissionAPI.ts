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

import { AxiosResponse } from 'axios';
import { ResourceEntity } from '../context/PermissionProvider/PermissionProvider.interface';
import { ResourcePermission } from '../generated/entity/policies/accessControl/resourcePermission';
import { EntityReference } from '../generated/entity/type';
import { Paging } from '../generated/type/paging';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

export const getLoggedInUserPermissions = async () => {
  const params = {
    limit: 100,
  };
  const response = await APIClient.get<{
    data: ResourcePermission[];
    paging: Paging;
  }>('/permissions', { params });

  return response.data;
};

export const getEntityPermissionById = async (
  resource: ResourceEntity,
  entityId: string
) => {
  const response = await APIClient.get<ResourcePermission>(
    `/permissions/${resource}/${entityId}`
  );

  return response.data;
};
export const getEntityPermissionByFqn = async (
  resource: ResourceEntity,
  entityFqn: string
) => {
  const response = await APIClient.get<ResourcePermission>(
    `/permissions/${resource}/name/${getEncodedFqn(entityFqn)}`
  );

  return response.data;
};

export const getResourcePermission = async (resource: ResourceEntity) => {
  const response = await APIClient.get<ResourcePermission>(
    `/permissions/${resource}`
  );

  return response.data;
};

// Permission Debug Types
export interface PermissionDebugInfo {
  user: EntityReference;
  directRoles: DirectRolePermission[];
  teamPermissions: TeamPermission[];
  inheritedPermissions: InheritedPermission[];
  summary: PermissionSummary;
}

export interface DirectRolePermission {
  role: EntityReference;
  policies: PolicyInfo[];
  source: string;
}

export interface TeamPermission {
  team: EntityReference;
  teamHierarchy: EntityReference[];
  rolePermissions: RolePermission[];
  directPolicies: PolicyInfo[];
  teamType: string;
  hierarchyLevel: number;
}

export interface RolePermission {
  role: EntityReference;
  policies: PolicyInfo[];
  inheritedFrom: string;
  isDefaultRole: boolean;
}

export interface InheritedPermission {
  permissionType: string;
  source?: EntityReference;
  policies: PolicyInfo[];
  description: string;
}

export interface PolicyInfo {
  policy: EntityReference;
  rules: RuleInfo[];
  effect: string;
}

export interface RuleInfo {
  name: string;
  effect: string;
  operations: string[];
  resources: string[];
  condition?: string;
  matches: boolean;
}

export interface PermissionSummary {
  totalRoles: number;
  totalPolicies: number;
  totalRules: number;
  directRoles: number;
  inheritedRoles: number;
  teamCount: number;
  maxHierarchyDepth: number;
  effectiveOperations: string[];
  deniedOperations: string[];
}

export interface PermissionEvaluationDebugInfo {
  user: EntityReference;
  resource: string;
  resourceId?: string;
  operation: string;
  allowed: boolean;
  finalDecision: string;
  evaluationSteps: PolicyEvaluationStep[];
  summary: EvaluationSummary;
}

export interface PolicyEvaluationStep {
  stepNumber: number;
  source: string;
  sourceEntity: EntityReference;
  policy: EntityReference;
  rule: string;
  effect: string;
  matched: boolean;
  matchReason: string;
  conditionEvaluations: ConditionEvaluation[];
}

export interface ConditionEvaluation {
  condition: string;
  result: boolean;
  evaluationDetails: string;
}

export interface EvaluationSummary {
  totalPoliciesEvaluated: number;
  totalRulesEvaluated: number;
  matchingRules: number;
  denyRules: number;
  allowRules: number;
  appliedPolicies: string[];
  reasonsForDecision: string[];
  evaluationTimeMs: number;
}

// Permission Debug API calls
export const getPermissionDebugInfo = async (
  username: string
): Promise<AxiosResponse<PermissionDebugInfo>> => {
  const response = await APIClient.get<PermissionDebugInfo>(
    `/permissions/debug/user/${username}`
  );

  return response;
};

export const getMyPermissionDebugInfo = async (): Promise<
  AxiosResponse<PermissionDebugInfo>
> => {
  const response = await APIClient.get<PermissionDebugInfo>(
    '/permissions/debug/me'
  );

  return response;
};

export const evaluatePermission = async (
  user: string,
  resource: string,
  operation: string,
  resourceId?: string
): Promise<AxiosResponse<PermissionEvaluationDebugInfo>> => {
  const params = new URLSearchParams({
    user,
    resource,
    operation,
  });

  if (resourceId) {
    params.append('resourceId', resourceId);
  }

  const response = await APIClient.get<PermissionEvaluationDebugInfo>(
    `/permissions/debug/evaluate?${params.toString()}`
  );

  return response;
};
