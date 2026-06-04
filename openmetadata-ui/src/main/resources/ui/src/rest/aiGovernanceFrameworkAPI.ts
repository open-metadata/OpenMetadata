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
import { EntityReference } from '../generated/type/entityReference';
import { Paging } from '../generated/type/paging';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

export type FrameworkSource = 'BuiltIn' | 'Custom' | 'ForkedFrom';
export type AssessmentCadence = 'Monthly' | 'Quarterly' | 'SemiAnnual' | 'Annual';

export interface FrameworkAutoApplyRules {
  assetTypes?: string[];
  regions?: string[];
  riskClasses?: string[];
  deploymentStages?: string[];
}

export interface AIGovernanceFramework {
  id?: string;
  name: string;
  fullyQualifiedName?: string;
  displayName?: string;
  description?: string;
  reference?: string;
  region?: string;
  source?: FrameworkSource;
  forkedFrom?: EntityReference;
  enabled?: boolean;
  stewards?: EntityReference[];
  assessmentCadence?: AssessmentCadence;
  autoApply?: FrameworkAutoApplyRules;
  nextDeadline?: number;
  owners?: EntityReference[];
  updatedAt?: number;
  updatedBy?: string;
  version?: number;
}

export interface CreateAIGovernanceFramework {
  name: string;
  displayName?: string;
  description?: string;
  reference?: string;
  region?: string;
  source?: FrameworkSource;
  forkedFrom?: string;
  enabled?: boolean;
  stewards?: EntityReference[];
  assessmentCadence?: AssessmentCadence;
  autoApply?: FrameworkAutoApplyRules;
  nextDeadline?: number;
  owners?: EntityReference[];
}

export interface AIFrameworkControl {
  id?: string;
  name: string;
  fullyQualifiedName?: string;
  displayName?: string;
  description?: string;
  framework: EntityReference;
  code?: string;
  category?: 'Risk' | 'Process' | 'Data' | 'Transparency' | 'Quality' | 'Governance';
  evidenceRequirements?: string[];
}

export interface FrameworkCoverageEntry {
  code: string;
  displayName?: string;
  category?: string;
  status: 'Met' | 'Partial' | 'Gap';
  affectedAssetCount: number;
  evidenceCount: number;
}

export interface FrameworkCoverageSummary {
  compliant: number;
  partial: number;
  nonCompliant: number;
}

export interface FrameworkCoverageResponse {
  frameworkId: string;
  frameworkName: string;
  assetsInScope?: number;
  controls: FrameworkCoverageEntry[];
  summary?: FrameworkCoverageSummary;
}

const FRAMEWORK_BASE = '/aiGovernanceFrameworks';
const CONTROL_BASE = '/aiFrameworkControls';

export const listFrameworks = async (params?: { limit?: number; fields?: string }) => {
  const response = await APIClient.get<{
    data: AIGovernanceFramework[];
    paging: Paging;
  }>(FRAMEWORK_BASE, { params });

  return response.data;
};

export const getFrameworkById = async (id: string, fields?: string) => {
  const response = await APIClient.get<AIGovernanceFramework>(
    `${FRAMEWORK_BASE}/${id}`,
    { params: { fields } }
  );

  return response.data;
};

export const getFrameworkByFqn = async (fqn: string, fields?: string) => {
  const response = await APIClient.get<AIGovernanceFramework>(
    `${FRAMEWORK_BASE}/name/${getEncodedFqn(fqn)}`,
    { params: { fields } }
  );

  return response.data;
};

export const createFramework = async (payload: CreateAIGovernanceFramework) => {
  const response = await APIClient.post<
    CreateAIGovernanceFramework,
    AxiosResponse<AIGovernanceFramework>
  >(FRAMEWORK_BASE, payload);

  return response.data;
};

export const patchFramework = async (id: string, ops: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<AIGovernanceFramework>
  >(`${FRAMEWORK_BASE}/${id}`, ops, {
    headers: { 'Content-Type': 'application/json-patch+json' },
  });

  return response.data;
};

export const toggleFrameworkEnabled = async (
  framework: AIGovernanceFramework,
  enabled: boolean
) => {
  if (!framework.id) {
    throw new Error('Framework has no id');
  }
  const ops: Operation[] =
    framework.enabled == null
      ? [{ op: 'add', path: '/enabled', value: enabled }]
      : [{ op: 'replace', path: '/enabled', value: enabled }];

  return patchFramework(framework.id, ops);
};

export const getFrameworkCoverage = async (id: string) => {
  const response = await APIClient.get<FrameworkCoverageResponse>(
    `${FRAMEWORK_BASE}/${id}/coverage`
  );

  return response.data;
};

export const forkFramework = async (
  id: string,
  body: { name?: string; displayName?: string }
) => {
  const response = await APIClient.post<
    typeof body,
    AxiosResponse<{ framework: AIGovernanceFramework; copiedControlsCount: number }>
  >(`${FRAMEWORK_BASE}/${id}/fork`, body);

  return response.data;
};

export const listControls = async (params?: {
  framework?: string;
  limit?: number;
  fields?: string;
}) => {
  const response = await APIClient.get<{
    data: AIFrameworkControl[];
    paging: Paging;
  }>(CONTROL_BASE, { params });

  return response.data;
};
