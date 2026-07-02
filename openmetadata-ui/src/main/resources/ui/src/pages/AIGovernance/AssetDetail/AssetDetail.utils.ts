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
import {
  GovernanceStatus,
  LlmModel,
} from '../../../generated/entity/ai/llmModel';
import { MCPServer } from '../../../generated/entity/ai/mcpServer';
import {
  RegistryFramework,
  RegistryFrameworkStatus,
  RegistryRegistrationStatus,
  RegistryRiskClassification,
} from '../sections/Registry/Registry.types';
import { AIAssetView, ComplianceRecordView } from './AssetDetail.types';

const FRAMEWORK_VALUES = Object.values(RegistryFramework) as string[];
const FRAMEWORK_STATUS_VALUES: RegistryFrameworkStatus[] = [
  'Compliant',
  'PartiallyCompliant',
  'NonCompliant',
  'UnderReview',
  'NotApplicable',
];
const RISK_VALUES: RegistryRiskClassification[] = [
  'Unacceptable',
  'High',
  'Limited',
  'Minimal',
];
const REGISTRATION_VALUES: RegistryRegistrationStatus[] = [
  'Registered',
  'Unregistered',
  'PendingApproval',
  'Approved',
  'Rejected',
];

const ANNEX_LABELS: Record<string, string> = {
  criticalInfrastructure: 'Annex III(1) — Critical infrastructure',
  educationVocationalTraining: 'Annex III(3) — Education & vocational training',
  employment: 'Annex III(4) — Employment & worker management',
  essentialPrivateServices: 'Annex III(5) — Essential private services',
  essentialPublicServices: 'Annex III(6) — Essential public services',
  lawEnforcement: 'Annex III(6) — Law enforcement',
  migrationAsylumBorderControl: 'Annex III(7) — Migration, asylum, borders',
  administrationOfJustice: 'Annex III(8) — Justice & democratic processes',
};

const asMember = <T extends string>(
  values: T[],
  v: string | undefined
): T | undefined => values.find((c) => c === v);

interface ExtractedCompliance {
  riskClassification?: RegistryRiskClassification;
  riskRationale?: string;
  highRiskAnnexes: string[];
  regions: string[];
  affectedUserCount?: number;
  certificateNumber?: string;
  certificateValidUntil?: number;
  certificateDocumentationUrl?: string;
  frameworkSummaries: AIAssetView['frameworkSummaries'];
}

const extractCompliance = (
  records: ComplianceRecordView[] | undefined
): ExtractedCompliance => {
  const result: ExtractedCompliance = {
    highRiskAnnexes: [],
    regions: [],
    frameworkSummaries: [],
  };
  if (!records || !Array.isArray(records)) {
    return result;
  }

  const regions = new Set<string>();
  const annexes = new Set<string>();
  for (const record of records) {
    const framework = asMember(FRAMEWORK_VALUES, record.framework) as
      | RegistryFramework
      | undefined;
    const status = asMember(FRAMEWORK_STATUS_VALUES, record.status);
    if (framework && status) {
      result.frameworkSummaries.push({
        framework,
        status,
        assessedBy: record.assessedBy,
        assessedAt: record.assessedAt,
        nextReviewDate: record.nextReviewDate,
      });
    }

    const risk = asMember(RISK_VALUES, record.euAIAct?.riskClassification);
    if (risk && !result.riskClassification) {
      result.riskClassification = risk;
      result.riskRationale = record.euAIAct?.riskRationale;
    }

    const highRiskSystems = record.euAIAct?.highRiskSystems;
    if (highRiskSystems) {
      Object.entries(highRiskSystems).forEach(([key, value]) => {
        if (value && ANNEX_LABELS[key]) {
          annexes.add(ANNEX_LABELS[key]);
        }
      });
    }

    record.scopeAndDeployment?.deploymentRegions?.forEach((r) =>
      regions.add(r)
    );
    if (
      typeof record.scopeAndDeployment?.affectedUserCount === 'number' &&
      result.affectedUserCount === undefined
    ) {
      result.affectedUserCount = record.scopeAndDeployment.affectedUserCount;
    }

    const conformity = record.euAIAct?.conformityAssessment;
    if (conformity?.certificateNumber && !result.certificateNumber) {
      result.certificateNumber = conformity.certificateNumber;
      result.certificateValidUntil = conformity.validUntil;
    }
    if (
      record.verification?.certificateUrl &&
      !result.certificateDocumentationUrl
    ) {
      result.certificateDocumentationUrl = record.verification.certificateUrl;
    }
  }

  result.regions = Array.from(regions);
  result.highRiskAnnexes = Array.from(annexes);

  return result;
};

const llmRegistrationFromGovernance = (
  status: GovernanceStatus | undefined
): RegistryRegistrationStatus => {
  let result: RegistryRegistrationStatus = 'Registered';
  if (status === GovernanceStatus.PendingReview) {
    result = 'PendingApproval';
  } else if (status === GovernanceStatus.Approved) {
    result = 'Approved';
  } else if (status === GovernanceStatus.Rejected) {
    result = 'Rejected';
  } else if (status === GovernanceStatus.Unauthorized) {
    result = 'Unregistered';
  }

  return result;
};

export const aiApplicationToView = (entity: AIApplication): AIAssetView => {
  const governance = entity.governanceMetadata;
  const rawRecords = (governance?.aiCompliance?.complianceRecords ??
    []) as ComplianceRecordView[];
  const compliance = extractCompliance(rawRecords);

  return {
    id: entity.id ?? '',
    name: entity.name,
    displayName: entity.displayName,
    fullyQualifiedName: entity.fullyQualifiedName ?? entity.name,
    description: entity.description,
    entityType: 'aiApplication',
    owners: entity.owners ?? [],
    tags: entity.tags ?? [],
    domain: entity.domain,
    domains: entity.domains ?? (entity.domain ? [entity.domain] : []),
    deployment: entity.developmentStage,
    applicationType: entity.applicationType,
    registrationStatus: asMember(
      REGISTRATION_VALUES,
      governance?.registrationStatus
    ),
    riskClassification: compliance.riskClassification,
    riskRationale: compliance.riskRationale,
    highRiskAnnexes: compliance.highRiskAnnexes,
    regions: compliance.regions,
    affectedUserCount: compliance.affectedUserCount,
    accessesPii: governance?.dataClassification?.accessesPII ?? false,
    accessesSensitive:
      governance?.dataClassification?.accessesSensitiveData ?? false,
    dataCategories: governance?.dataClassification?.dataCategories ?? [],
    frameworkSummaries: compliance.frameworkSummaries,
    certificate: compliance.certificateNumber
      ? {
          number: compliance.certificateNumber,
          validUntil: compliance.certificateValidUntil,
          documentationUrl: compliance.certificateDocumentationUrl,
        }
      : undefined,
    metrics: {
      totalExecutions: entity.performanceMetrics?.totalExecutions,
      successRate: entity.performanceMetrics?.successRate,
      averageLatencyMs: entity.performanceMetrics?.averageLatencyMs,
      p95LatencyMs: entity.performanceMetrics?.p95LatencyMs,
      totalCost: entity.performanceMetrics?.totalCost,
      averageCost: entity.performanceMetrics?.averageCost,
      currency: entity.performanceMetrics?.currency,
      biasDetected: entity.biasMetrics?.biasDetected,
      overallBiasScore: entity.biasMetrics?.overallBiasScore,
      hallucinationRate: entity.qualityMetrics?.hallucinationRate,
    },
    complianceRecords: rawRecords,
    source: { kind: 'aiApplication', entity },
  };
};

export const llmModelToView = (entity: LlmModel): AIAssetView => {
  const frameworkSummaries: AIAssetView['frameworkSummaries'] = [];
  (entity.regulatoryCompliance ?? []).forEach((value) => {
    const framework = asMember(FRAMEWORK_VALUES, value) as
      | RegistryFramework
      | undefined;
    if (framework) {
      frameworkSummaries.push({ framework, status: 'Compliant' });
    }
  });

  const region = entity.deploymentInfo?.region;

  return {
    id: entity.id ?? '',
    name: entity.name,
    displayName: entity.displayName,
    fullyQualifiedName: entity.fullyQualifiedName ?? entity.name,
    description: entity.description,
    entityType: 'llmModel',
    owners: entity.owners ?? [],
    tags: entity.tags ?? [],
    domain: entity.domain,
    domains: entity.domains ?? (entity.domain ? [entity.domain] : []),
    deployment: entity.deploymentInfo?.deploymentType,
    modelType: entity.modelType,
    registrationStatus: llmRegistrationFromGovernance(entity.governanceStatus),
    riskClassification: undefined,
    highRiskAnnexes: [],
    regions: region ? [region] : [],
    affectedUserCount: undefined,
    accessesPii: false,
    accessesSensitive: false,
    dataCategories: [],
    frameworkSummaries,
    certificate: undefined,
    metrics: {
      totalCost: entity.costMetrics?.estimatedMonthlyCost,
      averageCost: entity.costMetrics?.inputCostPer1kTokens,
      currency: entity.costMetrics?.currency,
    },
    complianceRecords: [],
    source: { kind: 'llmModel', entity },
  };
};

export const mcpServerToView = (entity: MCPServer): AIAssetView => {
  const governance = entity.governanceMetadata;
  const rawRecords = (governance?.aiCompliance?.complianceRecords ??
    []) as ComplianceRecordView[];
  const compliance = extractCompliance(rawRecords);

  return {
    id: entity.id ?? '',
    name: entity.name,
    displayName: entity.displayName,
    fullyQualifiedName: entity.fullyQualifiedName ?? entity.name,
    description: entity.description,
    entityType: 'mcpServer',
    owners: entity.owners ?? [],
    tags: entity.tags ?? [],
    domain: entity.domain,
    domains: entity.domains ?? (entity.domain ? [entity.domain] : []),
    deployment: entity.developmentStage,
    serverType: entity.serverType,
    registrationStatus: asMember(
      REGISTRATION_VALUES,
      governance?.registrationStatus
    ),
    riskClassification: compliance.riskClassification,
    riskRationale: compliance.riskRationale,
    highRiskAnnexes: compliance.highRiskAnnexes,
    regions: compliance.regions,
    affectedUserCount: compliance.affectedUserCount,
    accessesPii: governance?.dataClassification?.accessesPII ?? false,
    accessesSensitive:
      governance?.dataClassification?.accessesSensitiveData ?? false,
    dataCategories: governance?.dataClassification?.dataCategories ?? [],
    frameworkSummaries: compliance.frameworkSummaries,
    certificate: compliance.certificateNumber
      ? {
          number: compliance.certificateNumber,
          validUntil: compliance.certificateValidUntil,
          documentationUrl: compliance.certificateDocumentationUrl,
        }
      : undefined,
    metrics: {
      totalExecutions: entity.usageMetrics?.totalInvocations,
      successRate: entity.usageMetrics?.successRate,
      averageLatencyMs: entity.usageMetrics?.averageLatencyMs,
      p95LatencyMs: entity.usageMetrics?.p95LatencyMs,
    },
    complianceRecords: rawRecords,
    source: { kind: 'mcpServer', entity },
  };
};
