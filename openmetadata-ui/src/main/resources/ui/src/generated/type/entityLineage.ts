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
 * The `Lineage` for a given data asset, has information of the input datasets used and the
 * ETL pipeline that created it.
 */
export interface EntityLineage {
    downstreamEdges?: Edge[];
    /**
     * Primary entity for which this lineage graph is created.
     */
    entity:         EntityReference;
    nodes?:         EntityReference[];
    upstreamEdges?: Edge[];
}

/**
 * Edge in the lineage graph from one entity to another by entity IDs.
 */
export interface Edge {
    description?: string;
    /**
     * From entity that is upstream of lineage edge.
     */
    fromEntity: string;
    /**
     * Optional lineageDetails provided only for table to table lineage edge.
     */
    lineageDetails?: LineageDetails;
    /**
     * To entity that is downstream of lineage edge.
     */
    toEntity: string;
}

/**
 * Optional lineageDetails provided only for table to table lineage edge.
 *
 * Lineage details including sqlQuery + pipeline + columnLineage.
 */
export interface LineageDetails {
    /**
     * Asset count in case of child assets lineage.
     */
    assetEdges?: number;
    /**
     * Lineage information of how upstream columns were combined to get downstream column.
     */
    columnsLineage?: ColumnLineage[];
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    createdAt?: number;
    /**
     * User who created the node.
     */
    createdBy?: string;
    /**
     * description of lineage
     */
    description?: string;
    /**
     * Pipeline where the sqlQuery is periodically run.
     */
    pipeline?: EntityReference;
    /**
     * Lineage type describes how a lineage was created.
     */
    source?: Source;
    /**
     * SQL used for transformation.
     */
    sqlQuery?: string;
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    [property: string]: any;
}

export interface ColumnLineage {
    /**
     * One or more source columns identified by fully qualified column name used by
     * transformation function to create destination column.
     */
    fromColumns?: string[];
    /**
     * Transformation function applied to source columns to create destination column. That is
     * `function(fromColumns) -> toColumn`.
     */
    function?: string;
    /**
     * Destination column identified by fully qualified column name created by the
     * transformation of source columns.
     */
    toColumn?: string;
    [property: string]: any;
}

/**
 * Pipeline where the sqlQuery is periodically run.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Primary entity for which this lineage graph is created.
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
 * Lineage type describes how a lineage was created.
 */
export enum Source {
    ChildAssets = "ChildAssets",
    CrossDatabaseLineage = "CrossDatabaseLineage",
    DashboardLineage = "DashboardLineage",
    DbtLineage = "DbtLineage",
    ExternalTableLineage = "ExternalTableLineage",
    Manual = "Manual",
    OpenLineage = "OpenLineage",
    PipelineLineage = "PipelineLineage",
    QueryLineage = "QueryLineage",
    SparkLineage = "SparkLineage",
    ViewLineage = "ViewLineage",
}
