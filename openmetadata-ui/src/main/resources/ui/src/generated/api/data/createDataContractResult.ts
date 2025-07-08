/*
 *  Copyright 2025 Collate.
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
 * Create data contract result API request.
 */
export interface CreateDataContractResult {
    /**
     * Overall status of the contract execution.
     */
    contractExecutionStatus: ContractExecutionStatus;
    /**
     * Fully qualified name of the data contract.
     */
    dataContractFQN: string;
    /**
     * Time taken to execute the contract validation in milliseconds.
     */
    executionTime?: number;
    /**
     * Incident ID if the contract execution failed and an incident was created.
     */
    incidentId?: string;
    /**
     * Quality expectations validation details.
     */
    qualityValidation?: QualityValidation;
    /**
     * Detailed result of the data contract execution.
     */
    result?: string;
    /**
     * Schema validation details.
     */
    schemaValidation?: SchemaValidation;
    /**
     * Semantics validation details.
     */
    semanticsValidation?: SemanticsValidation;
    /**
     * SLA validation details.
     */
    slaValidation?: SlaValidation;
    /**
     * Timestamp when the data contract was executed.
     */
    timestamp: number;
}

/**
 * Overall status of the contract execution.
 *
 * Status of the data contract execution.
 */
export enum ContractExecutionStatus {
    Aborted = "Aborted",
    Failed = "Failed",
    PartialSuccess = "PartialSuccess",
    Queued = "Queued",
    Success = "Success",
}

/**
 * Quality expectations validation details.
 *
 * Quality validation details for data contract.
 */
export interface QualityValidation {
    /**
     * Number of quality checks failed.
     */
    failed?: number;
    /**
     * Number of quality checks passed.
     */
    passed?: number;
    /**
     * Overall quality score (0-100).
     */
    qualityScore?: number;
    /**
     * Total number of quality checks.
     */
    total?: number;
}

/**
 * Schema validation details.
 *
 * Schema validation details for data contract.
 */
export interface SchemaValidation {
    /**
     * Number of schema checks failed.
     */
    failed?: number;
    /**
     * List of fields that failed validation.
     */
    failedFields?: string[];
    /**
     * Number of schema checks passed.
     */
    passed?: number;
    /**
     * Total number of schema checks.
     */
    total?: number;
}

/**
 * Semantics validation details.
 *
 * Semantics validation details for data contract.
 */
export interface SemanticsValidation {
    /**
     * Number of semantics rules failed.
     */
    failed?: number;
    /**
     * List of rules that failed validation.
     */
    failedRules?: FailedRule[];
    /**
     * Number of semantics rules passed.
     */
    passed?: number;
    /**
     * Total number of semantics rules.
     */
    total?: number;
}

export interface FailedRule {
    reason?:   string;
    ruleName?: string;
}

/**
 * SLA validation details.
 *
 * SLA validation details for data contract.
 */
export interface SlaValidation {
    /**
     * Actual latency in milliseconds.
     */
    actualLatency?: number;
    /**
     * Whether availability requirement was met.
     */
    availabilityMet?: boolean;
    /**
     * Whether latency requirement was met.
     */
    latencyMet?: boolean;
    /**
     * Whether refresh frequency requirement was met.
     */
    refreshFrequencyMet?: boolean;
}
