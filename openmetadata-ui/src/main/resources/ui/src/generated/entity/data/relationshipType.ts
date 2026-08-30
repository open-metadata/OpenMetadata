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
 * An admin-governed semantic relationship definition used by Ontology Studio.
 */
export interface RelationshipType {
    cardinality?:         Cardinality;
    category:             Category;
    changeDescription?:   ChangeDescription;
    characteristics:      Characteristic[];
    crossGlossaryAllowed: boolean;
    deleted?:             boolean;
    description:          string;
    /**
     * Relationship types declared property-disjoint with this type.
     */
    disjointWith?:                 EntityReference[];
    displayName:                   string;
    domain?:                       SemanticReference[];
    entityStatus?:                 EntityStatus;
    fullyQualifiedName:            string;
    href?:                         string;
    id:                            string;
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Inverse relationship type. Symmetric types reference themselves.
     */
    inverse?: EntityReference;
    /**
     * IRI identifying the OWL object property.
     */
    iri?: string;
    /**
     * Immutable API key for this relationship type.
     */
    name:       string;
    owners?:    EntityReference[];
    paletteKey: PaletteKey;
    /**
     * Ordered property chain whose composition implies this relationship type.
     */
    propertyChain?: EntityReference[];
    provider?:      ProviderType;
    range?:         SemanticReference[];
    /**
     * Predicate emitted for authored relationship edges.
     */
    rdfPredicate: string;
    /**
     * Replacement relationship type when this type is deprecated.
     */
    replacedBy?: EntityReference;
    reviewers?:  EntityReference[];
    /**
     * System types can be updated but cannot be deleted.
     */
    systemDefined: boolean;
    updatedAt?:    number;
    updatedBy?:    string;
    version?:      number;
}

export interface Cardinality {
    sourceMax?: number;
    targetMax?: number;
}

export enum Category {
    Core = "CORE",
    Custom = "CUSTOM",
    OwlSkos = "OWL_SKOS",
}

/**
 * Description of the change.
 */
export interface ChangeDescription {
    changeSummary?: { [key: string]: ChangeSummary };
    /**
     * Names of fields added during the version changes.
     */
    fieldsAdded?: FieldChange[];
    /**
     * Fields deleted during the version changes with old value before deleted.
     */
    fieldsDeleted?: FieldChange[];
    /**
     * Fields modified during the version changes with old and new values.
     */
    fieldsUpdated?: FieldChange[];
    /**
     * When a change did not result in change, this could be same as the current version.
     */
    previousVersion?: number;
}

export interface ChangeSummary {
    changedAt?: number;
    /**
     * Name of the user or bot who made this change
     */
    changedBy?:    string;
    changeSource?: ChangeSource;
    [property: string]: any;
}

/**
 * The source of the change. This will change based on the context of the change (example:
 * manual vs programmatic)
 */
export enum ChangeSource {
    Automated = "Automated",
    Derived = "Derived",
    Ingested = "Ingested",
    Manual = "Manual",
    Propagated = "Propagated",
    Suggested = "Suggested",
}

export interface FieldChange {
    /**
     * Name of the entity field that changed.
     */
    name?: string;
    /**
     * New value of the field. Note that this is a JSON string and use the corresponding field
     * type to deserialize it.
     */
    newValue?: any;
    /**
     * Previous value of the field. Note that this is a JSON string and use the corresponding
     * field type to deserialize it.
     */
    oldValue?: any;
}

export enum Characteristic {
    Asymmetric = "ASYMMETRIC",
    Functional = "FUNCTIONAL",
    InverseFunctional = "INVERSE_FUNCTIONAL",
    Irreflexive = "IRREFLEXIVE",
    Reflexive = "REFLEXIVE",
    Symmetric = "SYMMETRIC",
    Transitive = "TRANSITIVE",
}

/**
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Resolved glossary term when the referenced resource is governed locally.
 *
 * Inverse relationship type. Symmetric types reference themselves.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Replacement relationship type when this type is deprecated.
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
 * Reference to a governed glossary term or an external semantic resource.
 */
export interface SemanticReference {
    /**
     * Canonical IRI of the referenced semantic resource.
     */
    iri: string;
    /**
     * Resolved glossary term when the referenced resource is governed locally.
     */
    term?: EntityReference;
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

export enum PaletteKey {
    Amber = "AMBER",
    Blue = "BLUE",
    Gray = "GRAY",
    Green = "GREEN",
    Indigo = "INDIGO",
    Pink = "PINK",
    Purple = "PURPLE",
    Rose = "ROSE",
    Teal = "TEAL",
    Violet = "VIOLET",
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
