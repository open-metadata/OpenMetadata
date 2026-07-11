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
 * Persona entity
 */
export interface CreatePersona {
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
     * Optional description of the team.
     */
    description?: string;
    /**
     * Optional name used for display purposes. Example 'Data Steward'.
     */
    displayName?: string;
    /**
     * Fully qualified names of the domains the Persona belongs to.
     */
    domains?: string[];
    name:     string;
    /**
     * Optional IDs of users that are going to assign a Persona.
     */
    users?: string[];
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
     * Render complete documentation for every matched entity and ignore sections. Fully
     * rendered Data Products also include the context of every contained asset.
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
