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
 * An independently governed ontology namespace. Formal definitions are stored as separate
 * entities.
 */
export interface Ontology {
    changeDescription?: ChangeDescription;
    deleted?:           boolean;
    description?:       string;
    displayName?:       string;
    fullyQualifiedName: string;
    href?:              string;
    id:                 string;
    /**
     * Bot user that performed the action on behalf of the actual user.
     */
    impersonatedBy?:               string;
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Verified library packs installed into this ontology, one entry per pack ID. The server
     * records an entry when a change set with a source pack applies. PUT keeps the stored
     * value, and PATCH cannot change it.
     */
    installedPacks?: OntologyPackInstallation[];
    /**
     * Stable semantic identity of this ontology; independent of its name and catalog record IRI.
     */
    iri:    string;
    layer?: Layer;
    name:   string;
    /**
     * Absolute namespace used to mint persistent IRIs for native definitions.
     */
    namespace:  string;
    owners?:    EntityReference[];
    prefixes?:  Prefix[];
    provider?:  ProviderType;
    reviewers?: EntityReference[];
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

/**
 * Durable provenance and version state for an installed ontology library pack.
 */
export interface OntologyPackInstallation {
    installedAt: number;
    installedBy: string;
    license:     string;
    licenseUrl:  string;
    modules:     OntologyPackModuleInstallation[];
    packId:      string;
    sourceUrl:   string;
    version:     string;
}

/**
 * Verified ontology pack module recorded as installation provenance.
 */
export interface OntologyPackModuleInstallation {
    moduleId: string;
    sha256:   string;
}

/**
 * Governance layer of an ontology model.
 */
export enum Layer {
    L1 = "L1",
    L2 = "L2",
    L3 = "L3",
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
 * A compact IRI prefix and its absolute namespace.
 */
export interface Prefix {
    namespace: string;
    prefix:    string;
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
