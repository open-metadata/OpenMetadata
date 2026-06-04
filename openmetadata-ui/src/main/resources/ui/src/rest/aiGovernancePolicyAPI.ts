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

import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import { AIGovernancePolicy } from '../generated/entity/ai/aiGovernancePolicy';
import { Paging } from '../generated/type/paging';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

const POLICY_BASE = '/aiGovernancePolicies';
const VIOLATIONS_BASE = '/aiGovernance/policies';

export interface PolicyViolation {
  entityType: string;
  entityId?: string;
  entityName?: string;
  ruleName: string;
  status: 'Passing' | 'Breached' | 'NotApplicable';
  value?: string;
  observedAt: number;
}

export interface PolicyViolationsResponse {
  data: PolicyViolation[];
}

export interface CreateAIGovernancePolicy {
  name: string;
  displayName?: string;
  description?: string;
  policyType?: string;
  severity?: string;
  enabled?: boolean;
  rules?: AIGovernancePolicy['rules'];
  appliesTo?: AIGovernancePolicy['appliesTo'];
  biasThresholds?: AIGovernancePolicy['biasThresholds'];
  complianceRequirements?: AIGovernancePolicy['complianceRequirements'];
  performanceStandards?: AIGovernancePolicy['performanceStandards'];
  dataAccessControls?: AIGovernancePolicy['dataAccessControls'];
  costControls?: AIGovernancePolicy['costControls'];
  owners?: AIGovernancePolicy['owners'];
}

export const listPolicies = async (params?: {
  limit?: number;
  fields?: string;
  after?: string;
  before?: string;
}) => {
  const response = await APIClient.get<{
    data: AIGovernancePolicy[];
    paging: Paging;
  }>(POLICY_BASE, { params });

  return response.data;
};

export const getPolicyById = async (id: string, fields?: string) => {
  const response = await APIClient.get<AIGovernancePolicy>(
    `${POLICY_BASE}/${id}`,
    { params: { fields } }
  );

  return response.data;
};

export const getPolicyByFqn = async (fqn: string, fields?: string) => {
  const response = await APIClient.get<AIGovernancePolicy>(
    `${POLICY_BASE}/name/${getEncodedFqn(fqn)}`,
    { params: { fields } }
  );

  return response.data;
};

export const createPolicy = async (payload: CreateAIGovernancePolicy) => {
  const response = await APIClient.post<
    CreateAIGovernancePolicy,
    AxiosResponse<AIGovernancePolicy>
  >(POLICY_BASE, payload);

  return response.data;
};

export const patchPolicy = async (id: string, ops: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<AIGovernancePolicy>
  >(`${POLICY_BASE}/${id}`, ops, {
    headers: { 'Content-Type': 'application/json-patch+json' },
  });

  return response.data;
};

export const deletePolicy = async (id: string, hardDelete = false) => {
  await APIClient.delete(`${POLICY_BASE}/${id}`, {
    params: { hardDelete, recursive: false },
  });
};

export const togglePolicyEnabled = async (
  policy: AIGovernancePolicy,
  enabled: boolean
) => {
  if (!policy.id) {
    throw new Error('Policy has no id');
  }
  const ops: Operation[] =
    policy.enabled == null
      ? [{ op: 'add', path: '/enabled', value: enabled }]
      : [{ op: 'replace', path: '/enabled', value: enabled }];

  return patchPolicy(policy.id, ops);
};

export const getPolicyViolations = async (
  policyId: string,
  params?: { since?: number; limit?: number }
) => {
  const response = await APIClient.get<PolicyViolationsResponse>(
    `${VIOLATIONS_BASE}/${policyId}/violations`,
    { params }
  );

  return response.data;
};
