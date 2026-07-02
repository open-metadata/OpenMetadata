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

import {
  AIApplication,
  ApplicationType,
} from '../../../../generated/entity/ai/aiApplication';
import {
  GovernanceStatus,
  LlmModel,
} from '../../../../generated/entity/ai/llmModel';
import { MCPServer } from '../../../../generated/entity/ai/mcpServer';
import {
  AIAssetRegistryRow,
  RegistryAssetType,
  RegistryFramework,
  RegistryFrameworkStatus,
  RegistryRegistrationStatus,
  RegistryRiskClassification,
} from './Registry.types';

const toFramework = (
  value: string | undefined
): RegistryFramework | undefined => {
  if (!value) {
    return undefined;
  }
  const allValues = Object.values(RegistryFramework) as string[];

  return allValues.includes(value) ? (value as RegistryFramework) : undefined;
};

const STATUS_VALUES: RegistryFrameworkStatus[] = [
  'Compliant',
  'PartiallyCompliant',
  'NonCompliant',
  'UnderReview',
  'NotApplicable',
];

const toFrameworkStatus = (
  value: string | undefined
): RegistryFrameworkStatus | undefined =>
  STATUS_VALUES.find((v) => v === value);

const RISK_VALUES: RegistryRiskClassification[] = [
  'Unacceptable',
  'High',
  'Limited',
  'Minimal',
];

const toRiskClassification = (
  value: string | undefined
): RegistryRiskClassification | undefined =>
  RISK_VALUES.find((v) => v === value);

const REGISTRATION_VALUES: RegistryRegistrationStatus[] = [
  'Registered',
  'Unregistered',
  'PendingApproval',
  'Approved',
  'Rejected',
];

const toRegistrationStatus = (
  value: string | undefined
): RegistryRegistrationStatus | undefined =>
  REGISTRATION_VALUES.find((v) => v === value);

interface ComplianceRecordView {
  framework?: string;
  status?: string;
  assessedAt?: number;
  euAIAct?: {
    riskClassification?: string;
  };
  scopeAndDeployment?: {
    deploymentRegions?: string[];
  };
}

const extractRowFromCompliance = (
  records: ComplianceRecordView[] | undefined
) => {
  const result: Pick<
    AIAssetRegistryRow,
    'frameworkStatuses' | 'regions' | 'riskClassification' | 'lastAssessedAt'
  > = {
    frameworkStatuses: {},
    regions: [],
    riskClassification: undefined,
    lastAssessedAt: undefined,
  };

  if (!records || !Array.isArray(records)) {
    return result;
  }

  const regions = new Set<string>();
  let latestAssessedAt: number | undefined;
  for (const record of records) {
    const framework = toFramework(record.framework);
    const status = toFrameworkStatus(record.status);
    if (framework && status) {
      result.frameworkStatuses[framework] = status;
    }
    const risk = toRiskClassification(record.euAIAct?.riskClassification);
    if (risk && !result.riskClassification) {
      result.riskClassification = risk;
    }
    record.scopeAndDeployment?.deploymentRegions?.forEach((r) =>
      regions.add(r)
    );
    if (
      typeof record.assessedAt === 'number' &&
      (latestAssessedAt === undefined || record.assessedAt > latestAssessedAt)
    ) {
      latestAssessedAt = record.assessedAt;
    }
  }

  result.regions = Array.from(regions);
  result.lastAssessedAt = latestAssessedAt;

  return result;
};

export const aiApplicationToRow = (app: AIApplication): AIAssetRegistryRow => {
  const isAgent =
    app.applicationType === ApplicationType.Agent ||
    app.applicationType === ApplicationType.MultiAgent;
  const governance = app.governanceMetadata;
  const complianceBits = extractRowFromCompliance(
    governance?.aiCompliance?.complianceRecords
  );

  return {
    id: app.id ?? '',
    name: app.name,
    displayName: app.displayName,
    fullyQualifiedName: app.fullyQualifiedName ?? app.name,
    description: app.description,
    entityType: 'aiApplication',
    assetType: isAgent
      ? RegistryAssetType.AGENT
      : RegistryAssetType.APPLICATION,
    owners: app.owners ?? [],
    domain: app.domain?.displayName ?? app.domain?.name,
    deployment: app.developmentStage,
    regions: complianceBits.regions,
    riskClassification: complianceBits.riskClassification,
    accessesPii: governance?.dataClassification?.accessesPII ?? false,
    accessesSensitive:
      governance?.dataClassification?.accessesSensitiveData ?? false,
    registrationStatus: toRegistrationStatus(governance?.registrationStatus),
    frameworkStatuses: complianceBits.frameworkStatuses,
    lastAssessedAt: complianceBits.lastAssessedAt,
  };
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

export const llmModelToRow = (model: LlmModel): AIAssetRegistryRow => {
  const frameworkStatuses: AIAssetRegistryRow['frameworkStatuses'] = {};
  (model.regulatoryCompliance ?? []).forEach((value) => {
    const framework = toFramework(value);
    if (framework) {
      frameworkStatuses[framework] = 'Compliant';
    }
  });

  const region = model.deploymentInfo?.region;

  return {
    id: model.id ?? '',
    name: model.name,
    displayName: model.displayName,
    fullyQualifiedName: model.fullyQualifiedName ?? model.name,
    description: model.description,
    entityType: 'llmModel',
    assetType: RegistryAssetType.LLM,
    owners: model.owners ?? [],
    domain: model.domain?.displayName ?? model.domain?.name,
    deployment: model.deploymentInfo?.deploymentType,
    regions: region ? [region] : [],
    riskClassification: undefined,
    accessesPii: false,
    accessesSensitive: false,
    registrationStatus: llmRegistrationFromGovernance(model.governanceStatus),
    frameworkStatuses,
    lastAssessedAt: undefined,
  };
};

export const mcpServerToRow = (server: MCPServer): AIAssetRegistryRow => {
  const governance = server.governanceMetadata;
  const complianceBits = extractRowFromCompliance(
    governance?.aiCompliance?.complianceRecords
  );

  return {
    id: server.id ?? '',
    name: server.name,
    displayName: server.displayName,
    fullyQualifiedName: server.fullyQualifiedName ?? server.name,
    description: server.description,
    entityType: 'mcpServer',
    assetType: RegistryAssetType.MCP,
    owners: server.owners ?? [],
    domain: server.domain?.displayName ?? server.domain?.name,
    deployment: server.developmentStage,
    regions: complianceBits.regions,
    riskClassification: complianceBits.riskClassification,
    accessesPii: governance?.dataClassification?.accessesPII ?? false,
    accessesSensitive:
      governance?.dataClassification?.accessesSensitiveData ?? false,
    registrationStatus: toRegistrationStatus(governance?.registrationStatus),
    frameworkStatuses: complianceBits.frameworkStatuses,
    lastAssessedAt: complianceBits.lastAssessedAt,
  };
};
