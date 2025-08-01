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
