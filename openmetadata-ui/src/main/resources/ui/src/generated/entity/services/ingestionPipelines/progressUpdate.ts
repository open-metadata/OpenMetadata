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
 * Real-time progress update for SSE streaming during ingestion pipeline execution
 */
export interface ProgressUpdate {
    /**
     * FQN of the entity currently being processed
     */
    currentEntity?: string;
    /**
     * Human-readable status message
     */
    message?: string;
    /**
     * Progress by entity type (e.g., Database, DatabaseSchema, Table). Keys are entity types,
     * values contain total, processed, and estimatedRemainingSeconds.
     */
    progress?: any;
    /**
     * Pipeline run ID
     */
    runId: string;
    /**
     * Name of the current step
     */
    stepName?: string;
    /**
     * When this update was created
     */
    timestamp: number;
    /**
     * Type of progress update
     */
    updateType: ProgressUpdateType;
}

/**
 * Type of progress update
 */
export enum ProgressUpdateType {
    Discovery = "DISCOVERY",
    Error = "ERROR",
    PipelineComplete = "PIPELINE_COMPLETE",
    Processing = "PROCESSING",
    StepComplete = "STEP_COMPLETE",
}
