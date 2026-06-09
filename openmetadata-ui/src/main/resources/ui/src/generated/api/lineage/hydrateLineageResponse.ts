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
 * Response of POST /v1/lineage/hydrate. Hydrated entities grouped by entityType. Entities
 * the caller cannot VIEW_BASIC are silently dropped from `entitiesByType` and counted in
 * `droppedCount`. Item shapes follow the per-type entity schemas (Table, Dashboard,
 * Pipeline, ...); the schema itself uses `object` because there is no discriminated-union
 * schema for `EntityInterface`.
 */
export interface HydrateLineageResponse {
    /**
     * Number of requested entities that were silently dropped because the caller does not have
     * VIEW_BASIC permission on them. Includes ids that did not resolve to any entity. Lets the
     * UI surface 'N items hidden by permissions' instead of silently swallowing them.
     */
    droppedCount?: number;
    /**
     * Hydrated entities keyed by entityType (table, dashboard, pipeline, topic, ...). Only
     * types with at least one authorized entity are present in the map.
     */
    entitiesByType: { [key: string]: { [key: string]: any }[] };
}
