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
 * One page of a native ontology's bound concepts ranked by binding count, the assets of
 * each that the caller may view, the object properties that join the returned concepts, and
 * observed lineage between the returned assets.
 */
export interface NativeOntologyDataGraph {
    /**
     * Ranked concept clusters in this page. Concepts with no viewable asset are left out.
     */
    clusters: NativeOntologyAssetCluster[];
    /**
     * Object property links whose endpoints are both returned clusters.
     */
    edges: ConceptEdge[];
    /**
     * Observed lineage whose endpoints are assets in the returned clusters.
     */
    lineageEdges: Edge[];
    /**
     * Offset pagination over the ontology's bound concepts.
     */
    paging: Paging;
}

/**
 * A native concept with the catalog assets bound to it that the caller may view.
 */
export interface NativeOntologyAssetCluster {
    /**
     * Cursor the concept's bindings endpoint accepts for the next page of viewable assets.
     * Absent when this page holds every viewable asset.
     */
    after?: string;
    /**
     * Number of bound assets the caller may view.
     */
    assetCount: number;
    /**
     * First page of viewable assets, ordered by asset id.
     */
    assets: Asset[];
    /**
     * Concept represented by the cluster.
     */
    concept: EntityReference;
}

export interface Asset {
    asset: EntityReference;
    /**
     * Number of column paths bound on this asset.
     */
    columnCount: number;
    /**
     * Service type of the asset, for asset types that record one.
     */
    serviceType?: string;
}

/**
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Concept represented by the cluster.
 *
 * The declared property, when this ontology declares one for the IRI and the caller may
 * view it.
 *
 * Pipeline where the sqlQuery is periodically run.
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
 * Two returned concepts that an object property joins, through an object property assertion
 * or a class restriction.
 */
export interface ConceptEdge {
    fromConceptId: string;
    /**
     * Display name or name of the declared property, or the local part of its IRI when the
     * ontology declares none the caller may view.
     */
    label: string;
    /**
     * The declared property, when this ontology declares one for the IRI and the caller may
     * view it.
     */
    property?: EntityReference;
    /**
     * IRI of the object property.
     */
    propertyIri: string;
    toConceptId: string;
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
     * Lineage path through temporary/intermediate tables. Each element represents a hop with
     * fromEntity and toEntity fields.
     */
    tempLineageTables?: TempLineageTable[];
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

/**
 * A single hop in a temporary table lineage path.
 */
export interface TempLineageTable {
    /**
     * Source entity or table name for this hop.
     */
    fromEntity: string;
    /**
     * Target entity or table name for this hop.
     */
    toEntity: string;
    [property: string]: any;
}

/**
 * Offset pagination over the ontology's bound concepts.
 *
 * Type used for cursor based pagination information in GET list responses.
 */
export interface Paging {
    /**
     * After cursor used for getting the next page (see API pagination for details).
     */
    after?: string;
    /**
     * Before cursor used for getting the previous page (see API pagination for details).
     */
    before?: string;
    /**
     * Limit used in case of offset based pagination.
     */
    limit?: number;
    /**
     * Offset used in case of offset based pagination.
     */
    offset?: number;
    /**
     * Total number of entries available to page through.
     */
    total: number;
}
