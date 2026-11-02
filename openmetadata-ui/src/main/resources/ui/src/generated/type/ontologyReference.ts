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
 * A derived reference from a working ontology definition to an exact semantic IRI.
 * References are scoped to their owning ontology, not resolved globally.
 */
export interface OntologyReference {
    iri:        string;
    ontologyId: string;
    role:       Role;
    source:     EntityReference;
}

export enum Role {
    AxiomSubject = "AXIOM_SUBJECT",
    ClassExpression = "CLASS_EXPRESSION",
    Datatype = "DATATYPE",
    DisjointProperty = "DISJOINT_PROPERTY",
    Domain = "DOMAIN",
    Individual = "INDIVIDUAL",
    Inverse = "INVERSE",
    MappingScheme = "MAPPING_SCHEME",
    MappingTarget = "MAPPING_TARGET",
    Property = "PROPERTY",
    PropertyChain = "PROPERTY_CHAIN",
    Range = "RANGE",
    ReplacedBy = "REPLACED_BY",
    SuperClass = "SUPER_CLASS",
}

/**
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
