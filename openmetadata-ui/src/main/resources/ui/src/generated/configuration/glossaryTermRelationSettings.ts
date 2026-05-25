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
 * This schema defines the Glossary Term Relation Settings for configuring typed semantic
 * relations between glossary terms.
 */
export interface GlossaryTermRelationSettings {
    /**
     * List of configured glossary term relation types.
     */
    relationTypes?: GlossaryTermRelationType[];
}

/**
 * Definition of a glossary term relation type.
 */
export interface GlossaryTermRelationType {
    /**
     * Preset cardinality for this relation type. CUSTOM lets you set explicit source/target
     * maxima.
     */
    cardinality?: RelationCardinality;
    /**
     * Category of the relation.
     */
    category: RelationCategory;
    /**
     * Hex color code for visualizing this relation type in graphs (e.g., '#1890ff').
     */
    color?: string;
    /**
     * Description of what this relation type represents.
     */
    description?: string;
    /**
     * Display name for the relation type.
     */
    displayName: string;
    /**
     * Name of the inverse relation type (e.g., 'narrower' for 'broader'). Null for symmetric
     * relations.
     */
    inverseRelation?: string;
    /**
     * Whether relations can be created between terms in different glossaries.
     */
    isCrossGlossaryAllowed?: boolean;
    /**
     * Whether the relation is symmetric (A relates B implies B relates A).
     */
    isSymmetric?: boolean;
    /**
     * Whether this is a system-defined relation type (cannot be deleted).
     */
    isSystemDefined?: boolean;
    /**
     * Whether the relation is transitive (A relates B, B relates C implies A relates C).
     */
    isTransitive?: boolean;
    /**
     * Unique name of the relation type (e.g., 'broader', 'synonym').
     */
    name: string;
    /**
     * RDF predicate URI for this relation (e.g., 'skos:broader').
     */
    rdfPredicate?: string;
    /**
     * Maximum number of relations of this type that can originate from a term. Null means
     * unbounded.
     */
    sourceMax?: number | null;
    /**
     * Maximum number of relations of this type that can target a term. Null means unbounded.
     */
    targetMax?: number | null;
}

/**
 * Preset cardinality for this relation type. CUSTOM lets you set explicit source/target
 * maxima.
 *
 * Preset cardinality for term-to-term relations.
 */
export enum RelationCardinality {
    Custom = "CUSTOM",
    ManyToMany = "MANY_TO_MANY",
    ManyToOne = "MANY_TO_ONE",
    OneToMany = "ONE_TO_MANY",
    OneToOne = "ONE_TO_ONE",
}

/**
 * Category of the relation.
 *
 * Category of the relation type.
 */
export enum RelationCategory {
    Associative = "associative",
    Equivalence = "equivalence",
    Hierarchical = "hierarchical",
}
