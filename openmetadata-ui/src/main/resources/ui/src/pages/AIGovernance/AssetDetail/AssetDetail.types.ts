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

import { AIApplication } from '../../../generated/entity/ai/aiApplication';
import { LlmModel } from '../../../generated/entity/ai/llmModel';
import { MCPServer } from '../../../generated/entity/ai/mcpServer';
import { EntityReference } from '../../../generated/type/entityReference';
import { TagLabel } from '../../../generated/type/tagLabel';
import {
  RegistryFramework,
  RegistryFrameworkStatus,
  RegistryRegistrationStatus,
  RegistryRiskClassification,
} from '../sections/Registry/Registry.types';

export type AIAssetEntityType = 'aiApplication' | 'llmModel' | 'mcpServer';

export enum AssetDetailTab {
  OVERVIEW = 'overview',
  COMPLIANCE = 'compliance',
  LINEAGE = 'lineage',
  POLICIES = 'policies',
  ACTIVITY = 'activity',
}

/**
 * Source entity union — the raw fetched payload, kept around so tab
 * implementations can read entity-specific fields when they need to.
 */
export type AIAssetSource =
  | { kind: 'aiApplication'; entity: AIApplication }
  | { kind: 'llmModel'; entity: LlmModel }
  | { kind: 'mcpServer'; entity: MCPServer };

/**
 * Structurally-typed compliance record. AIApplication and MCPServer both
 * generate a nominal `AIComplianceRecord` in their own modules; this view
 * keeps Compliance / Overview tab logic decoupled from either.
 */
export interface ComplianceRecordView {
  framework?: string;
  status?: string;
  assessedBy?: string;
  assessedAt?: number;
  nextReviewDate?: number;
  notes?: string;
  remediationRequired?: string[];
  euAIAct?: {
    riskClassification?: string;
    riskRationale?: string;
    prohibitedPractices?: Record<string, boolean | undefined>;
    highRiskSystems?: Record<string, boolean | undefined>;
    conformityAssessment?: {
      assessmentRequired?: boolean;
      assessmentType?: string;
      assessmentBody?: string;
      certificateNumber?: string;
      validUntil?: number;
    };
    transparencyObligations?: {
      usersInformed?: boolean;
      deepfakeLabeling?: boolean;
      emotionRecognitionDisclosure?: boolean;
    };
  };
  ethicalAssessment?: {
    privacyLevel?: string;
    fairnessRisk?: string;
    biasMitigationCoverage?: string;
    reliabilitySafetyRisk?: string;
    transparencyLevel?: string;
    environmentalConsciousness?: string;
    accountabilityMeasures?: {
      hasOwner?: boolean;
      subjectToHumanOversight?: boolean;
      auditTrailEnabled?: boolean;
    };
  };
  verification?: {
    isVerified?: boolean;
    verifiedBy?: string;
    verifiedAt?: number;
    certificateUrl?: string;
    verificationNotes?: string;
  };
  scopeAndDeployment?: {
    scope?: string;
    deploymentRegions?: string[];
    affectedUserCount?: number;
  };
}

/**
 * Normalised view of an asset that the Overview tab and header render against.
 * Fields not present on a given entity type are left undefined.
 */
export interface AIAssetView {
  id: string;
  name: string;
  displayName?: string;
  fullyQualifiedName: string;
  description?: string;
  entityType: AIAssetEntityType;
  owners: EntityReference[];
  tags: TagLabel[];
  domain?: EntityReference;
  domains: EntityReference[];
  deployment?: string;
  applicationType?: string;
  modelType?: string;
  serverType?: string;
  registrationStatus?: RegistryRegistrationStatus;
  riskClassification?: RegistryRiskClassification;
  riskRationale?: string;
  highRiskAnnexes: string[];
  regions: string[];
  affectedUserCount?: number;
  accessesPii: boolean;
  accessesSensitive: boolean;
  dataCategories: string[];
  frameworkSummaries: Array<{
    framework: RegistryFramework;
    status: RegistryFrameworkStatus;
    assessedBy?: string;
    assessedAt?: number;
    nextReviewDate?: number;
  }>;
  certificate?: {
    number?: string;
    validUntil?: number;
    documentationUrl?: string;
  };
  metrics: {
    totalExecutions?: number;
    successRate?: number;
    averageLatencyMs?: number;
    p95LatencyMs?: number;
    totalCost?: number;
    averageCost?: number;
    currency?: string;
    biasDetected?: boolean;
    overallBiasScore?: number;
    hallucinationRate?: number;
  };
  /**
   * Raw compliance records from the underlying entity, keyed by framework
   * later in the tab logic. Empty for LlmModel (whose `regulatoryCompliance`
   * is just a string list, surfaced separately in `frameworkSummaries`).
   */
  complianceRecords: ComplianceRecordView[];
  source: AIAssetSource;
}
