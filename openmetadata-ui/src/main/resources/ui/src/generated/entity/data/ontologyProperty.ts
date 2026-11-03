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
 * A formal object, data, or annotation property owned by an ontology, independent of
 * glossary relation types.
 */
export interface OntologyProperty {
    changeDescription?: ChangeDescription;
    characteristics?:   Characteristic[];
    deleted?:           boolean;
    /**
     * A deprecated definition stays resolvable for existing references but should not be used
     * for new ones.
     */
    deprecated?:  boolean;
    description?: string;
    /**
     * Semantic IRIs of properties disjoint with this property.
     */
    disjointWith?: string[];
    displayName?:  string;
    /**
     * Semantic IRIs of the classes in the property domain.
     */
    domain?: string[];
    /**
     * Allowed typed values for a DATA property, projected as an OWL data enumeration. An absent
     * datatype denotes xsd:string. Empty means no enumeration constraint; an enumeration needs
     * at least two allowed values.
     */
    enumValues?:        Literal[];
    fullyQualifiedName: string;
    href?:              string;
    id:                 string;
    /**
     * Bot user that performed the action on behalf of the actual user.
     */
    impersonatedBy?:               string;
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Semantic IRI of the inverse object property.
     */
    inverse?: string;
    /**
     * Persisted semantic IRI. Renaming the catalog entity must preserve this identity.
     */
    iri: string;
    /**
     * Identifier intent for a DATA property. This annotation does not assert functionality, an
     * OWL key, or uniqueness in source data.
     */
    isIdentifier?: boolean;
    kind:          Kind;
    name:          string;
    /**
     * Owning ontology entity. Glossaries do not own ontology definitions.
     */
    ontology: EntityReference;
    owners?:  EntityReference[];
    /**
     * Ordered object-property IRIs whose composition implies this property.
     */
    propertyChain?: string[];
    provider?:      ProviderType;
    /**
     * Semantic IRIs of range classes or datatypes.
     */
    range?: string[];
    /**
     * IRI of the property in the same ontology that replaces this one.
     */
    replacedBy?: string;
    /**
     * Unit IRI or display symbol for a DATA property, retained as an annotation without
     * implying conversion.
     */
    unit?:      string;
    updatedAt?: number;
    updatedBy?: string;
    version?:   number;
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
 * A typed OWL literal.
 */
export interface Literal {
    datatypeIri?: string;
    value:        string;
}

export enum Kind {
    Annotation = "ANNOTATION",
    Data = "DATA",
    Object = "OBJECT",
}

/**
 * Owning ontology entity. Glossaries do not own ontology definitions.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
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
