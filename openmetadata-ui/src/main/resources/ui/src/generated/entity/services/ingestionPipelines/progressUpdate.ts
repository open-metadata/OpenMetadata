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
     * Root of the hierarchical progress tree for this run
     */
    progress?: ProgressNode;
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
 * Root of the hierarchical progress tree for this run
 *
 * One node of the hierarchical progress tree. A node counts its direct children (root
 * counts databases, a database counts schemas, a schema counts tables).
 */
export interface ProgressNode {
    /**
     * Opened and not yet complete
     */
    active?: boolean;
    /**
     * Active or relevant child nodes only
     */
    children?: ProgressNode[];
    /**
     * Type of children this node counts (Database, DatabaseSchema, Table, ...)
     */
    entityType?: string;
    /**
     * Number of children, or null when the producer was iterated lazily
     */
    expected?: number;
    /**
     * Display name of this node (database or schema name; empty for the run root)
     */
    label?: string;
    /**
     * Active children beyond the per-parent display cap
     */
    overflow?: number;
    /**
     * Children completed
     */
    processed?: number;
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
