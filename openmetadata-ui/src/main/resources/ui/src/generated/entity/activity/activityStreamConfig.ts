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
 * Configuration for activity stream behavior at global or domain level.
 */
export interface ActivityStreamConfig {
    /**
     * Whether to generate activity events for this scope.
     */
    enabled: boolean;
    /**
     * Entity types to exclude from the activity stream.
     */
    excludeEntityTypes?: string[];
    /**
     * Event types to exclude from the activity stream.
     */
    excludeEventTypes?: string[];
    /**
     * Unique identifier for this configuration.
     */
    id: string;
    /**
     * How long to keep activity events before automatic deletion.
     */
    retentionDays?: number;
    /**
     * Whether this config applies globally or to a specific domain.
     */
    scope: ActivityStreamScope;
    /**
     * Reference to the domain this config applies to (when scope is 'domain').
     */
    scopeReference?: EntityReference;
    /**
     * Who can see activity events in this scope.
     */
    visibility?: ActivityStreamVisibility;
}

/**
 * Whether this config applies globally or to a specific domain.
 *
 * Scope of the activity stream configuration.
 */
export enum ActivityStreamScope {
    Domain = "domain",
    Global = "global",
}

/**
 * Reference to the domain this config applies to (when scope is 'domain').
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
 * Who can see activity events in this scope.
 *
 * Who can see activity events.
 */
export enum ActivityStreamVisibility {
    DomainOnly = "domainOnly",
    Organization = "organization",
}
