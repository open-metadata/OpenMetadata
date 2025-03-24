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
 * Refined data for Entity Report.
 */
export interface EntityReportData {
    /**
     * Number of completed description for the entity
     */
    completedDescriptions?: number;
    /**
     * number of entities
     */
    entityCount?: number;
    /**
     * Tier for the entity
     */
    entityTier?: string;
    /**
     * type of the entity
     */
    entityType?: string;
    /**
     * number of entities with owner
     */
    hasOwner?: number;
    /**
     * Number of missing description for the entity
     */
    missingDescriptions?: number;
    /**
     * number of entities missing owners
     */
    missingOwner?: number;
    /**
     * Organization associated with the entity (i.e. owner)
     */
    organization?: string;
    /**
     * Name of the service
     */
    serviceName?: string;
    /**
     * Team associated with the entity (i.e. owner)
     */
    team?: string;
}
