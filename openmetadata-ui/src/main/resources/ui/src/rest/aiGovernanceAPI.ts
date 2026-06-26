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

import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

const BASE = '/aiGovernance';

export type AIGovernanceEntityType = 'aiApplication' | 'llmModel' | 'mcpServer';

export interface IntakeCheck {
  name: string;
  passing: boolean;
  evidenceRef?: string;
}

export interface IntakeChecksResponse {
  checks: IntakeCheck[];
}

export interface TransitionRequest {
  comment?: string;
}

export interface BulkTriageItem {
  entityType: AIGovernanceEntityType;
  id: string;
}

export interface BulkTriageRequest {
  action: 'Register' | 'Dismiss';
  reason?: string;
  items: BulkTriageItem[];
}

export const getIntakeChecks = async (
  entityType: AIGovernanceEntityType,
  fqn: string
) => {
  const response = await APIClient.get<IntakeChecksResponse>(
    `${BASE}/intakeChecks/${entityType}/name/${getEncodedFqn(fqn)}`
  );

  return response.data;
};

export const submitForReview = async (
  entityType: AIGovernanceEntityType,
  id: string
) => {
  const response = await APIClient.post(
    `${BASE}/${entityType}/${id}/submitForReview`
  );

  return response.data;
};

export const approveAIAsset = async (
  entityType: AIGovernanceEntityType,
  id: string,
  comment?: string
) => {
  const response = await APIClient.post<TransitionRequest>(
    `${BASE}/${entityType}/${id}/approve`,
    { comment }
  );

  return response.data;
};

export const rejectAIAsset = async (
  entityType: AIGovernanceEntityType,
  id: string,
  comment: string
) => {
  const response = await APIClient.post<TransitionRequest>(
    `${BASE}/${entityType}/${id}/reject`,
    { comment }
  );

  return response.data;
};

export const shadowBulkTriage = async (request: BulkTriageRequest) => {
  const response = await APIClient.post<BulkTriageRequest>(
    `${BASE}/shadow/bulkTriage`,
    request
  );

  return response.data;
};

export interface EstateStats {
  total: number;
  registered: number;
  approved: number;
  shadow: number;
  pending: number;
  highRisk: number;
  unacceptable: number;
}

export interface FrameworkReadiness {
  framework: string;
  compliant: number;
  inScope: number;
  readiness: number;
  focus?: boolean;
}

export interface RiskMatrixTopEntity {
  name: string;
  displayName?: string;
  fullyQualifiedName: string;
  entityType: AIGovernanceEntityType;
}

export interface RiskMatrixCell {
  risk: 'Unacceptable' | 'High' | 'Limited' | 'Minimal';
  impactBucket: '<1k' | '1k–10k' | '10k–100k' | '>100k';
  count: number;
  topEntity?: RiskMatrixTopEntity;
}

export interface DashboardAssetSummary {
  entityType: AIGovernanceEntityType;
  id: string;
  name: string;
  displayName?: string;
  fullyQualifiedName: string;
  registrationStatus: string;
  euRisk?: string;
  affectedUsers?: number;
  registeredAt?: number;
  detectedVia?: string;
  detectedAt?: number;
  submittedBy?: string;
  submittedAt?: number;
  team?: string;
}

export interface DashboardResponse {
  estateStats: EstateStats;
  frameworkReadiness: FrameworkReadiness[];
  riskMatrix: RiskMatrixCell[];
  topShadow: DashboardAssetSummary[];
  topApprovals: DashboardAssetSummary[];
  generatedAt: number;
}

export const getAIGovernanceDashboard = async () => {
  const response = await APIClient.get<DashboardResponse>(`${BASE}/dashboard`);

  return response.data;
};

export interface GovernanceActivityEvent {
  entityType?: AIGovernanceEntityType;
  entityId?: string;
  entityName?: string;
  entityDisplayName?: string;
  entityFqn?: string;
  type: string;
  text: string;
  at: number;
  createdAt?: number;
  scheduledAt?: number;
  who?: string;
}

export interface GovernanceActivityResponse {
  events: GovernanceActivityEvent[];
}

export const getGovernanceActivity = async (params?: {
  entityType?: AIGovernanceEntityType;
  entityId?: string;
  limit?: number;
}) => {
  const response = await APIClient.get<GovernanceActivityResponse>(
    `${BASE}/activity`,
    {
      params,
    }
  );

  return response.data;
};

export interface PolicyRule {
  name: string;
  description: string;
  status: 'Passing' | 'Breached' | 'NotApplicable';
  value?: string;
}

export interface PolicyStatusResponse {
  rules: PolicyRule[];
}

export const getPolicyStatus = async (
  entityType: AIGovernanceEntityType,
  id: string
) => {
  const response = await APIClient.get<PolicyStatusResponse>(
    `${BASE}/${entityType}/${id}/policyStatus`
  );

  return response.data;
};
