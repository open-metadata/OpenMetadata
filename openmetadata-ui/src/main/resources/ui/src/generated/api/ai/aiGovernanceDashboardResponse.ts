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
/**
 * Rollup of AI governance dashboard state.
 */
export interface AIGovernanceDashboardResponse {
    estateStats: AIGovernanceEstateStats;
    /**
     * Per-framework readiness rollups.
     */
    frameworkReadiness: AIGovernanceFrameworkReadiness[];
    generatedAt:        number;
    /**
     * Risk and impact matrix cells.
     */
    riskMatrix: AIGovernanceRiskMatrixCell[];
    /**
     * Highest-priority pending approvals.
     */
    topApprovals: AIGovernanceAssetSummary[];
    /**
     * Highest-priority shadow AI detections.
     */
    topShadow: AIGovernanceAssetSummary[];
}

/**
 * Aggregate counts for the AI estate.
 */
export interface AIGovernanceEstateStats {
    approved:     number;
    highRisk:     number;
    pending:      number;
    registered:   number;
    shadow:       number;
    total:        number;
    unacceptable: number;
}

/**
 * Readiness rollup for one governance framework.
 */
export interface AIGovernanceFrameworkReadiness {
    /**
     * Number of compliant in-scope assets.
     */
    compliant: number;
    /**
     * Whether this framework is the current dashboard focus.
     */
    focus: boolean;
    /**
     * Framework name.
     */
    framework: string;
    /**
     * Number of assets in scope for the framework.
     */
    inScope: number;
    /**
     * Fraction of in-scope assets currently compliant.
     */
    readiness: number;
}

/**
 * Risk and impact matrix cell.
 */
export interface AIGovernanceRiskMatrixCell {
    /**
     * Number of AI assets in this cell.
     */
    count: number;
    /**
     * Affected-user impact bucket.
     */
    impactBucket: string;
    /**
     * EU AI Act risk tier.
     */
    risk:       string;
    topEntity?: AIGovernanceTopEntity;
}

/**
 * Compact AI asset reference.
 */
export interface AIGovernanceTopEntity {
    displayName?:        string;
    entityType?:         string;
    fullyQualifiedName?: string;
    name?:               string;
}

/**
 * AI asset summary used by governance dashboard top lists.
 */
export interface AIGovernanceAssetSummary {
    affectedUsers:       number;
    detectedAt?:         number;
    detectedVia?:        string;
    displayName?:        string;
    entityType:          string;
    euRisk?:             string;
    fullyQualifiedName?: string;
    id:                  string;
    name:                string;
    registeredAt?:       number;
    registrationStatus:  string;
    submittedAt?:        number;
    submittedBy?:        string;
    team?:               string;
}
