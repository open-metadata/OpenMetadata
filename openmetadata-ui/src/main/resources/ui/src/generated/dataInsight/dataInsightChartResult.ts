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
 * DataInsightChartResult represents data that will be consumed by a specific chart
 */
export interface DataInsightChartResult {
    /**
     * Chart Type that will consume the data. Must match name of dataInsightChart.
     */
    chartType: DataInsightChartType;
    /**
     * Array of consumable data.
     */
    data?: DailyActiveUsers[];
    /**
     * Total number of hits returned by the aggregation.
     */
    total?: number;
}

/**
 * Chart Type that will consume the data. Must match name of dataInsightChart.
 *
 * chart type. Must match `name` of a `dataInsightChartDefinition`.
 */
export enum DataInsightChartType {
    AggregatedUnusedAssetsCount = "AggregatedUnusedAssetsCount",
    AggregatedUnusedAssetsSize = "AggregatedUnusedAssetsSize",
    AggregatedUsedVsUnusedAssetsCount = "AggregatedUsedVsUnusedAssetsCount",
    AggregatedUsedVsUnusedAssetsSize = "AggregatedUsedVsUnusedAssetsSize",
    DailyActiveUsers = "DailyActiveUsers",
    MostActiveUsers = "MostActiveUsers",
    MostViewedEntities = "MostViewedEntities",
    PageViewsByEntities = "PageViewsByEntities",
    UnusedAssets = "UnusedAssets",
}

/**
 * dailyActiveUsers data blob
 *
 * pageViewsByEntities data blob
 *
 * UnusedAssets data blob
 *
 * AggregatedUnusedAssetsSize data blob
 *
 * AggregatedUnusedAssetsCount data blob
 *
 * AggregatedUsedVsUnusedAssetsSize data blob
 *
 * AggregatedUsedVsUnusedAssetsCount data blob
 */
export interface DailyActiveUsers {
    /**
     * Number of active users (user with at least 1 session).
     */
    activeUsers?: number;
    /**
     * timestamp
     */
    timestamp?: number;
    /**
     * Type of entity. Derived from the page URL.
     */
    entityType?: string;
    /**
     * Number of page views
     *
     * Total number of pages viewed by the user
     *
     * Type of entity. Derived from the page URL.
     */
    pageViews?: number;
    /**
     * avg. duration of a sessions in seconds
     */
    avgSessionDuration?: number;
    /**
     * date time of the most recent session for the user
     */
    lastSession?: number;
    /**
     * Total duration of all sessions in seconds
     */
    sessionDuration?: number;
    /**
     * Total number of sessions
     */
    sessions?: number;
    /**
     * Team a user belongs to
     */
    team?: string;
    /**
     * Name of a user
     */
    userName?: string;
    /**
     * Number of page views
     */
    entityFqn?: string;
    /**
     * Entity href link
     */
    entityHref?: string;
    /**
     * Owner of the entity
     */
    owner?: string;
    /**
     * Entity of the life cycle data
     */
    entity?: EntityReference;
    /**
     * timestamp
     */
    lastAccessedAt?: number;
    /**
     * Size of the asset in bytes
     */
    sizeInBytes?: number;
    /**
     * Frequently used Data Assets
     */
    frequentlyUsedDataAssets?: DataAssetValues;
    /**
     * Unused Data Assets
     */
    unusedDataAssets?: DataAssetValues;
    /**
     * Size of unused assets (last access >= 3 days)
     *
     * Count of unused assets (last access >= 3 days)
     */
    Unused?: number;
    /**
     * Percentage of the size of unused assets (last access >= 3 days)
     *
     * Percentage of the count of unused assets (last access >= 3 days)
     */
    UnusedPercentage?: number;
    /**
     * Size of used assets (last access < 3 days)
     *
     * Count of used assets (last access < 3 days)
     */
    Used?: number;
    /**
     * Percentage of the size of used assets (last access < 3 days)
     *
     * Percentage of the count of used assets (last access < 3 days)
     */
    UsedPercentage?: number;
}

/**
 * Entity of the life cycle data
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
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
 * Frequently used Data Assets
 *
 * Count or Size in bytes of Data Assets over a time period
 *
 * Unused Data Assets
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
