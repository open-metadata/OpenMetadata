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
 * TestConnectionResult is the definition that will encapsulate result of running the test
 * connection steps.
 */
export interface TestConnectionResult {
    /**
     * Last time that the test connection was executed
     */
    lastUpdatedAt?: number;
    /**
     * Test Connection Result computation status.
     */
    status?: StatusType;
    /**
     * Steps to test the connection. Order matters.
     */
    steps: TestConnectionStepResult[];
}

/**
 * Test Connection Result computation status.
 *
 * Enum defining possible Test Connection Result status
 */
export enum StatusType {
    Failed = "Failed",
    Running = "Running",
    Successful = "Successful",
}

/**
 * Function that tests one specific element of the service. E.g., listing schemas, lineage,
 * or tags.
 */
export interface TestConnectionStepResult {
    /**
     * Classified, actionable explanation of a failure, separate from the raw errorLog.
     */
    diagnosis?: Diagnosis;
    /**
     * Wall-clock time the step took, in milliseconds.
     */
    durationMs?: number;
    /**
     * In case of failed step, this field would contain the actual error faced during the step.
     */
    errorLog?: string;
    /**
     * The command or statement the step actually ran, when applicable.
     */
    executedCommand?: string;
    /**
     * Is this step mandatory to be passed?
     */
    mandatory: boolean;
    /**
     * Results or exceptions to be shared after running the test. This message comes from the
     * test connection definition
     */
    message?: string;
    /**
     * Name of the step being tested
     */
    name: string;
    /**
     * Did the step pass successfully?
     */
    passed: boolean;
    /**
     * Human-readable summary of what the step found on success.
     */
    resultSummary?: string;
    /**
     * Why a step did not run, when status is Skipped.
     */
    skipReason?: SkipReason;
    /**
     * Lifecycle state of this step.
     */
    status?: Status;
}

/**
 * Classified, actionable explanation of a failure, separate from the raw errorLog.
 */
export interface Diagnosis {
    /**
     * Link to relevant documentation.
     */
    docUrl?: string;
    /**
     * What the user can do to fix it.
     */
    remediation?: string;
    /**
     * Short statement of what went wrong.
     */
    title?: string;
}

/**
 * Why a step did not run, when status is Skipped.
 */
export enum SkipReason {
    ConnectionNotEstablished = "ConnectionNotEstablished",
    NotImplemented = "NotImplemented",
}

/**
 * Lifecycle state of this step.
 */
export enum Status {
    Failed = "Failed",
    Passed = "Passed",
    Queued = "Queued",
    Running = "Running",
    Skipped = "Skipped",
    Warning = "Warning",
}
