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
 * Semantic lineage scene response for map-style lineage navigation.
 */
export interface LineageScene {
    band:       LineageBand;
    breadcrumb: LineageSceneBreadcrumb[];
    edges:      LineageSceneEdge[];
    /**
     * Focused entity type.
     */
    focusEntityType?: string;
    /**
     * Focused entity or container FQN.
     */
    focusFqn?: string;
    /**
     * Number of nodes hidden by scene size limits.
     */
    hiddenNodeCount?: number;
    lens:             LineageLens;
    nodes:            LineageSceneNode[];
    /**
     * Originally opened asset entity type.
     */
    originEntityType?: string;
    /**
     * Originally opened asset FQN.
     */
    originFqn?: string;
    /**
     * Whether the scene was built from a sampled subset of matching assets.
     */
    sampled?: boolean;
}

/**
 * Semantic altitude band for lineage map scenes.
 */
export enum LineageBand {
    Asset = "ASSET",
    Field = "FIELD",
    Layer = "LAYER",
}

/**
 * Breadcrumb item for lineage scene navigation.
 */
export interface LineageSceneBreadcrumb {
    band: LineageBand;
    /**
     * OpenMetadata entity type.
     */
    entityType?: string;
    /**
     * Entity or container fully qualified name.
     */
    fullyQualifiedName?: string;
    /**
     * Stable breadcrumb identifier.
     */
    id: string;
    /**
     * Display label.
     */
    label:     string;
    levelKind: LineageLevelKind;
}

/**
 * Concrete hierarchy level rendered in a lineage scene.
 */
export enum LineageLevelKind {
    APIEndpoint = "apiEndpoint",
    Asset = "asset",
    Chart = "chart",
    Column = "column",
    Container = "container",
    Dashboard = "dashboard",
    DashboardDataModel = "dashboardDataModel",
    DataProduct = "dataProduct",
    Database = "database",
    Directory = "directory",
    Domain = "domain",
    Feature = "feature",
    Field = "field",
    File = "file",
    Metric = "metric",
    Model = "model",
    Pipeline = "pipeline",
    Schema = "schema",
    SearchIndex = "searchIndex",
    Service = "service",
    Spreadsheet = "spreadsheet",
    StoredProcedure = "storedProcedure",
    Table = "table",
    Task = "task",
    Topic = "topic",
    Worksheet = "worksheet",
}

/**
 * Edge rendered in a lineage map scene.
 */
export interface LineageSceneEdge {
    band: LineageBand;
    /**
     * Description associated with this concrete lineage edge.
     */
    description?: string;
    /**
     * Source node id or field id.
     */
    from: string;
    /**
     * Stable edge identifier.
     */
    id: string;
    /**
     * Whether this edge aggregates lower-level lineage edges.
     */
    isRollup?: boolean;
    /**
     * Optional edge label.
     */
    label?: string;
    /**
     * Pipeline or stored procedure associated with this concrete lineage edge.
     */
    pipeline?: EntityReference;
    /**
     * Lineage source.
     */
    source?: string;
    /**
     * SQL or transform text associated with this edge.
     */
    sqlQuery?: string;
    /**
     * Target node id or field id.
     */
    to: string;
    /**
     * Field-level transform expression.
     */
    transform?: string;
    /**
     * Concrete edge ids represented by this scene edge.
     */
    underlyingEdgeIds?: string[];
    /**
     * Number of concrete edges represented by this scene edge.
     */
    weight?: number;
}

/**
 * Pipeline or stored procedure associated with this concrete lineage edge.
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
 * Container lens used to group lineage.
 */
export enum LineageLens {
    DataProduct = "dataProduct",
    Domain = "domain",
    Service = "service",
}

/**
 * Node rendered in a lineage map scene.
 */
export interface LineageSceneNode {
    band: LineageBand;
    /**
     * Certification badge label when present.
     */
    certification?: string;
    /**
     * Known child count for the next meaningful level.
     */
    childrenCount?: number;
    /**
     * Counts by concrete level kind.
     */
    counts?: { [key: string]: number };
    /**
     * Optional display name from the entity.
     */
    displayName?: string;
    /**
     * OpenMetadata entity type.
     */
    entityType?: string;
    /**
     * Fields rendered for field-level scenes.
     */
    fields?: LineageSceneField[];
    /**
     * Entity or synthetic container FQN.
     */
    fullyQualifiedName?: string;
    /**
     * Children hidden by scene size limits.
     */
    hiddenChildrenCount?: number;
    /**
     * Stable node identifier.
     */
    id: string;
    /**
     * Whether drilling into this node can load a deeper meaningful scene.
     */
    isExpandable?: boolean;
    /**
     * Whether this node is the current scene focus.
     */
    isFocus?: boolean;
    /**
     * Whether this node is contextual and visually de-emphasized.
     */
    isGhost?: boolean;
    /**
     * Whether this node contains or equals the originally opened asset.
     */
    isOrigin?: boolean;
    /**
     * Display label.
     */
    label:     string;
    levelKind: LineageLevelKind;
    /**
     * Parent FQN in the lineage ladder.
     */
    parentFqn?: string;
    /**
     * Parent node id in the lineage ladder.
     */
    parentId?: string;
    /**
     * Connector/service type for type-aware drilling and icons.
     */
    serviceType?: string;
    /**
     * Original search entity payload for existing lineage UI behavior.
     */
    sourceEntity?: { [key: string]: any };
}

/**
 * Typed field rendered inside a field-level lineage node.
 */
export interface LineageSceneField {
    /**
     * Field data type label.
     */
    dataType?: string;
    /**
     * Field fully qualified name.
     */
    fullyQualifiedName?: string;
    /**
     * Stable field identifier.
     */
    id: string;
    /**
     * Field display name.
     */
    name: string;
}
