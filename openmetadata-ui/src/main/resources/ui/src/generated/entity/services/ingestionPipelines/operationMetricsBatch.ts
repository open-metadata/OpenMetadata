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
 * Batch of operation metrics for efficient transmission during ingestion pipeline execution
 */
export interface OperationMetricsBatch {
    /**
     * When this batch was created
     */
    batchTimestamp?: number;
    /**
     * List of operation metrics
     */
    metrics: OperationMetric[];
    /**
     * Pipeline run ID
     */
    runId: string;
    /**
     * Name of the ingestion step
     */
    stepName: string;
}

/**
 * Single operation metric with flexible categorization
 */
export interface OperationMetric {
    /**
     * High-level category: db_queries, api_calls, entity_operations
     */
    category: string;
    /**
     * Duration of the operation in milliseconds
     */
    durationMs?: number;
    /**
     * Fully qualified name of the entity if applicable
     */
    entityFqn?: string;
    /**
     * Entity type being operated on (Table, Dashboard, Pipeline, etc.) - free form string
     */
    entityType?: string;
    /**
     * Error message if operation failed
     */
    errorMessage?: string;
    /**
     * Additional context (query text snippet, response size, etc.)
     */
    metadata?: { [key: string]: any };
    /**
     * Operation name - free form string like 'SELECT', 'GET:/dashboards', 'yield_columns'
     */
    operation: string;
    /**
     * Whether the operation succeeded
     */
    success?: boolean;
    /**
     * When the operation occurred
     */
    timestamp: number;
}
