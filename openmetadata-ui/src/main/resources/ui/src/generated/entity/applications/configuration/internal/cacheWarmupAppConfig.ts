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
 * Cache Warmup Application Configuration.
 */
export interface CacheWarmupAppConfig {
    /**
     * Number of entities to process in each batch.
     */
    batchSize?: number;
    /**
     * Number of parallel threads for processing entities and warming cache.
     */
    consumerThreads?: number;
    /**
     * List of entity types to warm up in cache. Use 'all' to warm up all entity types.
     */
    entities?: string[];
    /**
     * Force cache warmup even if another instance is detected (use with caution).
     */
    force?: boolean;
    /**
     * Internal queue size for entity processing pipeline.
     */
    queueSize?: number;
    /**
     * Application Type
     */
    type?: CacheWarmupType;
}

/**
 * Application Type
 *
 * Application type.
 */
export enum CacheWarmupType {
    CacheWarmup = "CacheWarmup",
}
