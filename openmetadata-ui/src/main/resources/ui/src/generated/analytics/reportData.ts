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
 * Report Data
 */
export interface ReportData {
    /**
     * Data captured
     */
    data?: DataClass;
    /**
     * Unique identifier for a result.
     */
    id?: string;
    /**
     * Type of data
     */
    reportDataType?: ReportDataType;
    /**
     * timestamp for of a result ingestion.
     */
    timestamp: number;
    [property: string]: any;
}

/**
 * Data captured
 *
 * Refined data for Entity Report.
 *
 * Refined data for overview report
 *
 * Raw data for Cost Analysis Report.
 *
 * Aggregated data for Cost Analysis Report.
 */
export interface DataClass {
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
     *
     * entity tier
     */
    entityTier?: string;
    /**
     * type of the entity
     *
     * entity type
     *
     * Type of the entity
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
     *
     * the team the user belongs to
     */
    team?: string;
    /**
     * latest session
     */
    lastSession?: number;
    /**
     * total user count
     */
    totalPageView?: number;
    /**
     * total user count
     */
    totalSessionDuration?: number;
    /**
     * total number of sessions
     */
    totalSessions?: number;
    /**
     * user ID in OM
     */
    userId?: string;
    /**
     * user name
     */
    userName?: string;
    /**
     * entity fully qualified name
     */
    entityFqn?: string;
    /**
     * entity href
     */
    entityHref?: string;
    /**
     * Name of the entity owner
     */
    owner?: string;
    /**
     * Name of the entity owner
     */
    ownerId?: string;
    /**
     * Tags FQN
     */
    tagsFQN?: string[];
    /**
     * Number of time the entity was viewed
     */
    views?: number;
    /**
     * Entity of the life cycle data
     */
    entity?: EntityReference;
    /**
     * Life Cycle data related to the entity
     */
    lifeCycle?: LifeCycle;
    /**
     * Entity size in bytes
     */
    sizeInByte?: number;
    /**
     * Count and Size of the frequently used Data Assets over a period of time
     */
    frequentlyUsedDataAssets?: DataAssetMetrics;
    /**
     * Name of the service owner
     */
    serviceOwner?: string;
    /**
     * Type of the service
     */
    serviceType?: string;
    /**
     * Total Count
     */
    totalCount?: number;
    /**
     * Total Size based in Bytes
     */
    totalSize?: number;
    /**
     * Count and Size of the unused Data Assets over a period of time
     */
    unusedDataAssets?: DataAssetMetrics;
}

/**
 * Entity of the life cycle data
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * User, Pipeline, Query that created,updated or accessed the data asset
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}

/**
 * Count and Size of the frequently used Data Assets over a period of time
 *
 * Store the Count and Size in bytes of the Data Assets over a time period
 *
 * Count and Size of the unused Data Assets over a period of time
 */
export interface DataAssetMetrics {
    /**
     * Count of the Data Assets over a period of time
     */
    count?: DataAssetValues;
    /**
     * Size of the Data Assets over a period of time
     */
    size?: DataAssetValues;
    /**
     * Total Count
     */
    totalCount?: number;
    /**
     * Total Size based in Bytes
     */
    totalSize?: number;
    [property: string]: any;
}

/**
 * Count of the Data Assets over a period of time
 *
 * Count or Size in bytes of Data Assets over a time period
 *
 * Size of the Data Assets over a period of time
 */
export interface DataAssetValues {
    /**
     * Data Asset Count or Size for 14 days
     */
    fourteenDays?: number | null;
    /**
     * Data Asset Count or Size for 7 days
     */
    sevenDays?: number | null;
    /**
     * Data Asset Count or Size for 60 days
     */
    sixtyDays?: number | null;
    /**
     * Data Asset Count or Size for 30 days
     */
    thirtyDays?: number | null;
    /**
     * Data Asset Count or Size for 3 days
     */
    threeDays?: number | null;
}

/**
 * Life Cycle data related to the entity
 *
 * This schema defines Life Cycle Properties.
 */
export interface LifeCycle {
    /**
     * Access Details about accessed aspect of the data asset
     */
    accessed?: AccessDetails;
    /**
     * Access Details about created aspect of the data asset
     */
    created?: AccessDetails;
    /**
     * Access Details about updated aspect of the data asset
     */
    updated?: AccessDetails;
}

/**
 * Access Details about accessed aspect of the data asset
 *
 * Access details of an entity
 *
 * Access Details about created aspect of the data asset
 *
 * Access Details about updated aspect of the data asset
 */
export interface AccessDetails {
    /**
     * User, Pipeline, Query that created,updated or accessed the data asset
     */
    accessedBy?: EntityReference;
    /**
     * Any process that accessed the data asset that is not captured in OpenMetadata.
     */
    accessedByAProcess?: string;
    /**
     * Timestamp of data asset accessed for creation, update, read.
     */
    timestamp: number;
}

/**
 * Type of data
 */
export enum ReportDataType {
    AggregatedCostAnalysisReportData = "aggregatedCostAnalysisReportData",
    EntityReportData = "entityReportData",
    RawCostAnalysisReportData = "rawCostAnalysisReportData",
    WebAnalyticEntityViewReportData = "webAnalyticEntityViewReportData",
    WebAnalyticUserActivityReportData = "webAnalyticUserActivityReportData",
}
