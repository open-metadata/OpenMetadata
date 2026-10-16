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
 * Request to soft-delete entities within a scope that were not reported by the ingestion
 * connector in the current run (stale entities).
 */
export interface BulkDeleteStaleRequest {
    /**
     * When true, the response lists entities that would be deleted without performing the
     * deletion.
     */
    dryRun?: boolean;
    /**
     * When true, stale entities are hard-deleted. When false (default), they are soft-deleted.
     */
    hardDelete?: boolean;
    /**
     * When true (default), deleting a stale entity also deletes its children.
     */
    recursive?: boolean;
    /**
     * Entity type of the scope FQN, for example service, database, or databaseSchema.
     */
    scopeEntityType: string;
    /**
     * Fully qualified name of the scope (service, database, or databaseSchema) within which
     * stale entities are detected.
     */
    scopeFqn: string;
    /**
     * Fully qualified names of entities reported by the connector in the current run. Entities
     * in the scope not present in this list are considered stale.
     */
    seenFqns: string[];
}
