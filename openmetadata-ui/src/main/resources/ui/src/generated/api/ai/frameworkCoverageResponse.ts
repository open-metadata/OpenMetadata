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
 * Per-control compliance coverage roll-up for an AI Governance Framework.
 */
export interface FrameworkCoverageResponse {
    assetsInScope: number;
    controls:      FrameworkControlCoverage[];
    frameworkId?:  string;
    frameworkName: string;
    summary:       FrameworkCoverageSummary;
}

/**
 * Coverage status for a single framework control.
 */
export interface FrameworkControlCoverage {
    /**
     * Number of in-scope assets that are not fully meeting this control.
     */
    affectedAssetCount: number;
    category?:          ControlCategory;
    /**
     * Stable short code for the control.
     */
    code: string;
    /**
     * Human-readable control label.
     */
    displayName?: string;
    /**
     * Number of evidence items found for this control.
     */
    evidenceCount: number;
    /**
     * Aggregated coverage status for this control.
     */
    status: Status;
}

export enum ControlCategory {
    Data = "Data",
    Governance = "Governance",
    Process = "Process",
    Quality = "Quality",
    Risk = "Risk",
    Transparency = "Transparency",
}

/**
 * Aggregated coverage status for this control.
 */
export enum Status {
    Gap = "Gap",
    Met = "Met",
    Partial = "Partial",
}

/**
 * Compliance summary across assets in scope for the framework.
 */
export interface FrameworkCoverageSummary {
    compliant:    number;
    nonCompliant: number;
    partial:      number;
}
