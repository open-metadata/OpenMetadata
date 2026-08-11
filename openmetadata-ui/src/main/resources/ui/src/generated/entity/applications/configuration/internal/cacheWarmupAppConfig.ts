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
 * Cache Warmup Application Configuration.
 */
export interface CacheWarmupAppConfig {
    /**
     * Number of entities to process in each batch.
     */
    batchSize?: number;
    /**
     * In multi-instance deployments, claim each entity type via Redis SETNX so only one
     * instance warms it. Disable to let every instance warm independently (idempotent but
     * redundant).
     */
    enableDistributedClaim?: boolean;
    /**
     * List of entity types to warm up in cache. Use 'all' to warm up all entity types.
     */
    entities?: string[];
    /**
     * Force cache warmup even if another instance is detected (use with caution).
     */
    force?: boolean;
    /**
     * Application Type
     */
    type?: CacheWarmupType;
    /**
     * Pre-warm the per-entity bundle cache (tags + certification) so the first read after
     * deploy doesn't fan out to the DB. Disable for very large installs.
     */
    warmBundles?: boolean;
    /**
     * Optionally pre-warm common relationship fields in the read bundle cache. Requires Warm
     * Read Bundles. This adds extra relationship-table and entity-reference reads during
     * warmup, so enable it only when first-read relationship latency matters.
     */
    warmRelationships?: boolean;
}

/**
 * Application Type
 *
 * Application type.
 */
export enum CacheWarmupType {
    CacheWarmup = "CacheWarmup",
}
