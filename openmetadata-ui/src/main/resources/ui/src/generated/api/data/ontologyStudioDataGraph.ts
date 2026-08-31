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
 * A bounded page of term-to-asset clusters, connected semantic context, and observed
 * lineage for Ontology Studio data mode.
 */
export interface OntologyStudioDataGraph {
    /**
     * Ranked term-to-asset clusters in this page followed by bounded connected context
     * clusters. Paging applies only to the ranked clusters.
     */
    clusters: OntologyStudioAssetCluster[];
    /**
     * Bounded semantic and hierarchy relations whose endpoints are present in the returned
     * clusters.
     */
    edges: GlossaryTermRelationGraphEdge[];
    /**
     * Bounded observed lineage whose endpoints are assets in the returned cluster previews.
     */
    lineageEdges: Edge[];
    /**
     * Offset pagination for ranked seed clusters, excluding connected context clusters.
     */
    paging: Paging;
}

/**
 * A glossary term and its bounded asset preview for Ontology Studio data mode.
 */
export interface OntologyStudioAssetCluster {
    /**
     * Total number of assets tagged with the term.
     */
    assetCount: number;
    /**
     * Bounded first page of assets tagged with the term.
     */
    assets: OntologyStudioAsset[];
    /**
     * Glossary term represented by the cluster.
     */
    term: GlossaryTermRelationGraphNode;
}

/**
 * A bounded asset preview displayed by Ontology Studio data mode.
 */
export interface OntologyStudioAsset {
    /**
     * Number of columns exposed by a tabular asset.
     */
    columnCount?: number;
    /**
     * Asset reference.
     */
    entity: EntityReference;
    /**
     * Service that owns the asset when available from search.
     */
    service?: EntityReference;
    /**
     * Service implementation type when available from search.
     */
    serviceType?: string;
}

/**
 * Asset reference.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Service that owns the asset when available from search.
 *
 * Resolved first-class relationship type.
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
 * Glossary term represented by the cluster.
 *
 * A glossary term represented as a node in the relation graph.
 */
export interface GlossaryTermRelationGraphNode {
    /**
     * Optional display name of the glossary term.
     */
    displayName?: string;
    /**
     * Fully qualified name of the glossary term.
     */
    fullyQualifiedName: string;
    /**
     * Identifier of the glossary term.
     */
    id: string;
    /**
     * Name of the glossary term.
     */
    name: string;
}

/**
 * A directed, typed relation between two glossary terms.
 */
export interface GlossaryTermRelationGraphEdge {
    createdAt?: number;
    createdBy?: string;
    /**
     * Identifier of the source glossary term.
     */
    from: string;
    /**
     * Stable logical relationship identifier.
     */
    id:         string;
    provenance: Provenance;
    /**
     * Resolved first-class relationship type.
     */
    relationshipType?: EntityReference;
    /**
     * Configured type of the glossary relation.
     */
    relationType: string;
    status:       EntityStatus;
    /**
     * Identifier of the target glossary term.
     */
    to: string;
}

/**
 * How this relation edge originated.
 */
export enum Provenance {
    AISuggested = "AiSuggested",
    Imported = "Imported",
    Inferred = "Inferred",
    Manual = "Manual",
}

/**
 * Status of an entity. It is used for governance and is applied to all the entities in the
 * catalog.
 */
export enum EntityStatus {
    Approved = "Approved",
    Archived = "Archived",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
    Rejected = "Rejected",
    Unprocessed = "Unprocessed",
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
 * Offset pagination for ranked seed clusters, excluding connected context clusters.
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
