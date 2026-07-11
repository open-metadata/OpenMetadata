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
 * This schema defines the Persona entity. A `Persona` is a job function associated with a
 * user. An Example, Data Engineer or Data Consumer is a Persona of a user in Metadata world.
 */
export interface Persona {
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * Rules and settings used to materialize the shared AI context for this persona.
     */
    contextDefinition?: PersonaContextDefinition;
    /**
     * When true, this persona is the system-wide default persona that will be applied to users
     * who don't have any persona assigned or no default persona set.
     */
    default?: boolean;
    /**
     * Description of the persona.
     */
    description?: string;
    /**
     * Name used for display purposes. Example 'Data Steward'.
     */
    displayName?: string;
    /**
     * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
     * it belongs to.
     */
    domains?: EntityReference[];
    /**
     * FullyQualifiedName same as `name`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    id:    string;
    /**
     * Bot user that performed the action on behalf of the actual user.
     */
    impersonatedBy?: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * A unique name of Persona. Example 'data engineer'
     */
    name: string;
    /**
     * Reference to the UI customization configuration.
     */
    uiCustomization?: EntityReference;
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
     * Users that are assigned a persona.
     */
    users?: EntityReference[];
    /**
     * Metadata version of the entity.
     */
    version?: number;
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
 * Rules and settings used to materialize the shared AI context for this persona.
 *
 * Rules and materialization settings for the shared AI context document attached to a
 * Persona.
 */
export interface PersonaContextDefinition {
    /**
     * Read-only state of the compiled context cache.
     */
    cacheState?: CacheState;
    /**
     * Number of minutes a compiled context remains fresh before it is regenerated.
     */
    cacheTtlMinutes?: number;
    /**
     * Deprecated alias for cacheTtlMinutes retained for stored persona compatibility.
     */
    cacheTtlSeconds?: number;
    /**
     * Hard character cap for the compiled Markdown document.
     */
    characterBudget?: number;
    /**
     * Whether persona context is enabled.
     */
    enabled?: boolean;
    /**
     * Read-only reason the latest compilation failed.
     */
    lastError?: string;
    /**
     * Read-only timestamp of the most recent successful compilation.
     */
    lastGeneratedAt?: number;
    /**
     * Deprecated alias for characterBudget retained for stored persona compatibility.
     */
    maxTotalChars?: number;
    /**
     * Ordered dynamic entity-selection rules. An entity matched by multiple rules is rendered
     * under the first rule only.
     */
    rules?: ContextRule[];
}

/**
 * Read-only state of the compiled context cache.
 *
 * Current state of the compiled persona context document.
 */
export enum CacheState {
    Failed = "FAILED",
    Fresh = "FRESH",
    Generating = "GENERATING",
    Stale = "STALE",
}

/**
 * A dynamic entity-selection rule whose query is evaluated whenever the persona context is
 * materialized.
 */
export interface ContextRule {
    /**
     * Place this rule before relevance-scoped rules so its content is injected into every
     * request.
     */
    alwaysInContext?: boolean;
    /**
     * Optional explanation of why these entities belong in the persona context.
     */
    description?: string;
    /**
     * Whether the rule participates in materialization.
     */
    enabled?: boolean;
    /**
     * Entity type selected by the rule, for example table, dashboard, glossaryTerm, page, or
     * metric.
     */
    entityType: string;
    /**
     * Serialized react-awesome-query-builder JSON tree used only to restore the rule editor UI.
     */
    filterJsonTree?: string;
    /**
     * Render complete documentation for every matched entity and ignore sections. Fully rendered
     * Data Products also include the context of every contained asset.
     */
    fullyRendered?: boolean;
    /**
     * Stable identifier used by the persona AI context rule CRUD APIs.
     */
    id?: string;
    /**
     * Read-only count of entities currently matched by this rule.
     */
    matchedCount?: number;
    /**
     * Maximum number of matching entities to include from this rule.
     */
    maxAssets?: number;
    /**
     * Unique display name for the rule within this persona.
     */
    name: string;
    /**
     * Elasticsearch query DSL string emitted by the Explore query builder. Empty selects every
     * entity of the configured type.
     */
    queryFilter?: string;
    /**
     * Entity-type-specific documentation sections to render. Ignored when fullyRendered is true.
     */
    sections?: ContextSection[];
}

/**
 * A section of an entity's documentation that can be included by a persona context rule.
 */
export enum ContextSection {
    Articles = "articles",
    Constraints = "constraints",
    DataQuality = "dataQuality",
    Definition = "definition",
    Description = "description",
    FormulaExpression = "formulaExpression",
    FullBody = "fullBody",
    GlossaryTerms = "glossaryTerms",
    Joins = "joins",
    Lineage = "lineage",
    Metrics = "metrics",
    Owner = "owner",
    Profile = "profile",
    RelatedAssets = "relatedAssets",
    RelatedTerms = "relatedTerms",
    Schema = "schema",
    Synonyms = "synonyms",
    Tags = "tags",
    TitleSummary = "titleSummary",
    UnitGrain = "unitGrain",
}

/**
 * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
 * it belongs to.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Reference to the UI customization configuration.
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
