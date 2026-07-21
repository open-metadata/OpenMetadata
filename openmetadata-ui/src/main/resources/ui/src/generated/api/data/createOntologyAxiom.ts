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
 * Create or update a governed OWL axiom.
 */
export interface CreateOntologyAxiom {
    axiomType:    AxiomType;
    description:  string;
    displayName:  string;
    entityStatus: EntityStatus;
    expressions?: OntologyExpression[];
    glossary:     string;
    literal?:     Literal;
    name:         string;
    owners?:      EntityReference[];
    propertyIri?: string;
    provenance:   Provenance;
    provider?:    ProviderType;
    reviewers?:   EntityReference[];
    subjectIri:   string;
    targetIri?:   string;
}

export enum AxiomType {
    ClassAssertion = "CLASS_ASSERTION",
    DataPropertyAssertion = "DATA_PROPERTY_ASSERTION",
    DisjointWith = "DISJOINT_WITH",
    EquivalentClass = "EQUIVALENT_CLASS",
    ObjectPropertyAssertion = "OBJECT_PROPERTY_ASSERTION",
    SubclassOf = "SUBCLASS_OF",
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
 * A recursive OWL class expression represented without untyped maps.
 *
 * Class expression qualifying a restriction.
 */
export interface OntologyExpression {
    /**
     * Non-negative cardinality for MIN, MAX, and EXACT restrictions.
     */
    cardinality?: number;
    /**
     * Class IRI when kind is NAMED_CLASS.
     */
    classIri?: string;
    /**
     * Class expression qualifying a restriction.
     */
    filler?: OntologyExpression;
    /**
     * Individual value for an object has-value restriction.
     */
    individualIri?: string;
    /**
     * Named individuals used by an enumeration expression.
     */
    individualIris?: string[];
    kind:            ExpressionKind;
    /**
     * Literal value for a data has-value restriction.
     */
    literal?: Literal;
    /**
     * Nested expressions for intersection and union expressions.
     */
    operands?: OntologyExpression[];
    /**
     * Property constrained by a restriction.
     */
    propertyIri?:     string;
    restrictionKind?: RestrictionKind;
}

/**
 * Kind of recursive class expression.
 */
export enum ExpressionKind {
    Intersection = "INTERSECTION",
    NamedClass = "NAMED_CLASS",
    OneOf = "ONE_OF",
    Restriction = "RESTRICTION",
    Union = "UNION",
}

/**
 * Literal value for a data has-value restriction.
 *
 * A typed OWL literal.
 */
export interface Literal {
    datatypeIri?: string;
    value:        string;
}

/**
 * Supported OWL restriction operator.
 */
export enum RestrictionKind {
    Exact = "EXACT",
    Max = "MAX",
    Min = "MIN",
    Only = "ONLY",
    Some = "SOME",
    Value = "VALUE",
}

/**
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
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
 * How this relation edge originated.
 */
export enum Provenance {
    AISuggested = "AiSuggested",
    Imported = "Imported",
    Inferred = "Inferred",
    Manual = "Manual",
}

/**
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled. Some apps such as AutoPilot create entities with
 * `automation` provider type. These entities can be deleted by the user.
 */
export enum ProviderType {
    Automation = "automation",
    System = "system",
    User = "user",
}
