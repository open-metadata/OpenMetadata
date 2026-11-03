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
 * Selected native graph page and bounded replacement topology for the canonical loaded
 * context. A topology cursor means the generation is incomplete. Binding revisions do not
 * freeze lineage, axioms or permissions.
 */
export interface NativeOntologyDataGraphPage {
    bindings?: OntologyConceptBindingsResponse;
    clusters?: NativeOntologyAssetCluster[];
    /**
     * True when the loaded context holds the 60-concept maximum. No further cluster can be
     * loaded into it, so nextClusterOffset is omitted even when unloaded clusters remain.
     */
    contextFull:        boolean;
    loaded:             LoadedPrefix[];
    nextClusterOffset?: number;
    topology:           Topology;
}

/**
 * One page of a concept's bindings, ordered by asset id and filtered by canonical catalog
 * visibility. Hidden and deleted assets contribute no associations, paths, or counts.
 */
export interface OntologyConceptBindingsResponse {
    /**
     * Cursor for the next page. Absent when no rows follow. One request examines a bounded
     * number of rows, so a page can hold fewer than limit assets while a cursor follows, and
     * the last page can be empty.
     */
    after?:   string;
    assets:   AssetBinding[];
    revision: number;
}

export interface AssetBinding {
    asset:     EntityReference;
    assetId:   string;
    assetType: AssetType;
    columns:   ColumnBinding[];
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

export enum AssetType {
    APIEndpoint = "apiEndpoint",
    Chart = "chart",
    Container = "container",
    Dashboard = "dashboard",
    DashboardDataModel = "dashboardDataModel",
    Metric = "metric",
    Mlmodel = "mlmodel",
    Pipeline = "pipeline",
    SearchIndex = "searchIndex",
    StoredProcedure = "storedProcedure",
    Table = "table",
    Topic = "topic",
}

export interface ColumnBinding {
    column?:    Column;
    columnPath: string[];
    property?:  EntityReference;
    propertyId: string;
    /**
     * Unresolved when the exact column is missing or the property is unavailable or no longer
     * applicable. No rename inference is performed.
     */
    state: State;
}

export interface Column {
    dataType:            DataType;
    dataTypeDisplay?:    string;
    description?:        string;
    displayName?:        string;
    fullyQualifiedName?: string;
    name:                string;
}

/**
 * This enum defines the type of data stored in a column.
 */
export enum DataType {
    AggState = "AGG_STATE",
    Aggregatefunction = "AGGREGATEFUNCTION",
    Array = "ARRAY",
    Bigint = "BIGINT",
    Binary = "BINARY",
    Bit = "BIT",
    Bitmap = "BITMAP",
    Blob = "BLOB",
    Boolean = "BOOLEAN",
    Bytea = "BYTEA",
    Byteint = "BYTEINT",
    Bytes = "BYTES",
    CIDR = "CIDR",
    Char = "CHAR",
    Clob = "CLOB",
    Date = "DATE",
    Datetime = "DATETIME",
    Datetimerange = "DATETIMERANGE",
    Decimal = "DECIMAL",
    Double = "DOUBLE",
    Enum = "ENUM",
    Error = "ERROR",
    Fixed = "FIXED",
    Float = "FLOAT",
    Geography = "GEOGRAPHY",
    Geometry = "GEOMETRY",
    Heirarchy = "HEIRARCHY",
    Hierarchyid = "HIERARCHYID",
    Hll = "HLL",
    Hllsketch = "HLLSKETCH",
    Image = "IMAGE",
    Inet = "INET",
    Int = "INT",
    Interval = "INTERVAL",
    Ipv4 = "IPV4",
    Ipv6 = "IPV6",
    JSON = "JSON",
    Kpi = "KPI",
    Largeint = "LARGEINT",
    Long = "LONG",
    Longblob = "LONGBLOB",
    Lowcardinality = "LOWCARDINALITY",
    Macaddr = "MACADDR",
    Map = "MAP",
    Measure = "MEASURE",
    MeasureHidden = "MEASURE HIDDEN",
    MeasureVisible = "MEASURE VISIBLE",
    Mediumblob = "MEDIUMBLOB",
    Mediumtext = "MEDIUMTEXT",
    Money = "MONEY",
    Ntext = "NTEXT",
    Null = "NULL",
    Number = "NUMBER",
    Numeric = "NUMERIC",
    PGLsn = "PG_LSN",
    PGSnapshot = "PG_SNAPSHOT",
    Point = "POINT",
    Polygon = "POLYGON",
    QuantileState = "QUANTILE_STATE",
    Record = "RECORD",
    Rowid = "ROWID",
    Set = "SET",
    Smallint = "SMALLINT",
    Spatial = "SPATIAL",
    String = "STRING",
    Struct = "STRUCT",
    Super = "SUPER",
    Table = "TABLE",
    Text = "TEXT",
    Time = "TIME",
    Timestamp = "TIMESTAMP",
    Timestampz = "TIMESTAMPZ",
    Tinyint = "TINYINT",
    Tsquery = "TSQUERY",
    Tsvector = "TSVECTOR",
    Tuple = "TUPLE",
    TxidSnapshot = "TXID_SNAPSHOT",
    UUID = "UUID",
    Uint = "UINT",
    Union = "UNION",
    Unknown = "UNKNOWN",
    Varbinary = "VARBINARY",
    Varchar = "VARCHAR",
    Variant = "VARIANT",
    XML = "XML",
    Year = "YEAR",
}

/**
 * Unresolved when the exact column is missing or the property is unavailable or no longer
 * applicable. No rename inference is performed.
 */
export enum State {
    Resolved = "resolved",
    Unresolved = "unresolved",
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

export interface LoadedPrefix {
    bindingRevision: number;
    conceptId:       string;
    /**
     * Inclusive UUID high-water mark, including hidden rows traversed by a binding page. Absent
     * means no assets have been loaded for this concept. This is a context hint, not an
     * authorization grant.
     */
    throughAssetId?: string;
}

export interface Topology {
    after?:        string;
    contextDigest: string;
    edges:         ConceptEdge[];
    lineageEdges:  Edge[];
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
