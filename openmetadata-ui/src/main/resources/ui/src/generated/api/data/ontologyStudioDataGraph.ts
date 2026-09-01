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
 * A bounded page of term-to-asset clusters and semantic relations for Ontology Studio data
 * mode.
 */
export interface OntologyStudioDataGraph {
    /**
     * Term-to-asset clusters in this page.
     */
    clusters: OntologyStudioAssetCluster[];
    /**
     * Semantic relations whose endpoints are both present in this page.
     */
    edges: GlossaryTermRelationGraphEdge[];
    /**
     * Offset pagination for clusters.
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
 * Offset pagination for clusters.
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
