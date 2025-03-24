/*
 *  Copyright 2025 Collate.
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
 * This schema defines a type as an entity. Types includes property types and entity types.
 * Custom types can also be defined by the users to extend the metadata system.
 */
export interface Type {
    category?: Category;
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * Custom properties added to extend the entity. Only available for entity type
     */
    customProperties?: CustomProperty[];
    /**
     * List of data products this entity is part of.
     */
    dataProducts?: EntityReference[];
    /**
     * Optional description of entity.
     */
    description: string;
    /**
     * Display Name that identifies this type.
     */
    displayName?: string;
    /**
     * Domain the asset belongs to. When not set, the asset inherits the domain from the parent
     * it belongs to.
     */
    domain?: EntityReference;
    /**
     * FullyQualifiedName same as `name`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to this table resource.
     */
    href?: string;
    /**
     * Unique identifier of the type instance.
     */
    id?: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Unique name that identifies the type.
     */
    name: string;
    /**
     * Namespace or group to which this type belongs to. For example, some of the property types
     * commonly used can come from `basic` namespace. Some of the entities such as `table`,
     * `database`, etc. come from `data` namespace.
     */
    nameSpace?: string;
    /**
     * JSON schema encoded as string that defines the type. This will be used to validate the
     * type values.
     */
    schema?: string;
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    /**
     * Metadata version of the entity.
     */
    version?: number;
}

/**
 * Metadata category to which a type belongs to.
 */
export enum Category {
    Entity = "entity",
    Field = "field",
}

/**
 * Change that lead to this version of the entity.
 *
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
 * This schema defines the custom property to an entity to extend it.
 */
export interface CustomProperty {
    customPropertyConfig?: CustomPropertyConfig;
    description:           string;
    /**
     * Display Name for the custom property.Must be unique for an entity.
     */
    displayName?: string;
    /**
     * Name of the entity property. Note a property name must be unique for an entity. Property
     * name must follow camelCase naming adopted by openMetadata - must start with lower case
     * with no space, underscore, or dots.
     */
    name:         string;
    propertyType: EntityReference;
}

/**
 * Config to define constraints around CustomProperty
 */
export interface CustomPropertyConfig {
    config?: string[] | Config | string;
}

/**
 * Applies to Enum type, this config is used to define list of enum values
 *
 * Custom property configuration for table-type property where all column data types are
 * strings.
 */
export interface Config {
    multiSelect?: boolean;
    values?:      string[];
    /**
     * List of column names defined at the entity type level.
     */
    columns?:    string[];
    maxColumns?: number;
    minColumns?: number;
}

/**
 * Reference to a property type. Only property types are allowed and entity types are not
 * allowed as custom properties to extend an existing entity
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * List of data products this entity is part of.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Domain the asset belongs to. When not set, the asset inherits the domain from the parent
 * it belongs to.
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
