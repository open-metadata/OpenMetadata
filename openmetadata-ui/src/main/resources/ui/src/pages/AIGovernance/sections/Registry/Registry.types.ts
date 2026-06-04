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

import { EntityReference } from '../../../../generated/type/entityReference';

export enum RegistryAssetType {
  ALL = 'all',
  APPLICATION = 'app',
  AGENT = 'agent',
  LLM = 'llm',
  MCP = 'mcp',
}

export enum RegistryRiskFilter {
  ALL = 'all',
  UNACCEPTABLE = 'Unacceptable',
  HIGH = 'High',
  LIMITED = 'Limited',
  MINIMAL = 'Minimal',
}

export enum RegistryFramework {
  EU_AI_ACT = 'EU_AI_Act',
  NIST_AI_RMF = 'NIST_AI_RMF',
  ISO_IEC_42001 = 'ISO_IEC_42001',
  SINGAPORE_MGF = 'Singapore_Model_AI_Governance',
  CANADA_AIDA = 'Canada_AIDA',
  US_BILL_OF_RIGHTS = 'US_AI_Bill_of_Rights',
  UK_AI = 'UK_AI_Regulation',
  CHINA_AI = 'China_AI_Regulations',
  CUSTOM = 'Custom',
}

export type RegistryRiskClassification =
  | 'Unacceptable'
  | 'High'
  | 'Limited'
  | 'Minimal';

export type RegistryRegistrationStatus =
  | 'Registered'
  | 'Unregistered'
  | 'PendingApproval'
  | 'Approved'
  | 'Rejected';

export type RegistryFrameworkStatus =
  | 'Compliant'
  | 'PartiallyCompliant'
  | 'NonCompliant'
  | 'UnderReview'
  | 'NotApplicable';

export interface AIAssetRegistryRow {
  id: string;
  name: string;
  displayName?: string;
  fullyQualifiedName: string;
  description?: string;
  entityType: 'aiApplication' | 'llmModel' | 'mcpServer';
  assetType: RegistryAssetType;
  owners: EntityReference[];
  domain?: string;
  deployment?: string;
  regions: string[];
  riskClassification?: RegistryRiskClassification;
  accessesPii: boolean;
  accessesSensitive: boolean;
  registrationStatus?: RegistryRegistrationStatus;
  frameworkStatuses: Partial<
    Record<RegistryFramework, RegistryFrameworkStatus>
  >;
  lastAssessedAt?: number;
}
