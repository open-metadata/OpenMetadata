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
 * AI Context (also called a Context Profile) for a data asset. A normalized, LLM-ready
 * projection of an asset's structural signals and the business knowledge attached to it
 * (glossary terms, metrics, Context Center articles). It is assembled server-side so any
 * agent can pull the full context for an asset of any type (table, dashboard, pipeline,
 * topic, ...) in a single call to give strong signals to downstream tasks such as SQL
 * generation. The common envelope (identity, knowledge, lineage) applies to every entity
 * type; the type-specific structural details live under `assetContext`.
 */
export interface AIContext {
    /**
     * Context Center articles and knowledge pills attached to the asset.
     */
    articles?: KnowledgeItem[];
    /**
     * Type-specific structural context for the asset.
     */
    assetContext?: AssetContext;
    description?:  string;
    displayName?:  string;
    /**
     * Immediate downstream lineage (fully qualified names).
     */
    downstream?: string[];
    /**
     * Entity type of the asset (table, dashboard, pipeline, topic, ...).
     */
    entityType?: string;
    /**
     * Content fingerprint of this context, including attached knowledge, used to detect
     * staleness.
     */
    fingerprint?: string;
    /**
     * Fully qualified name of the asset this context describes.
     */
    fullyQualifiedName?: string;
    /**
     * Time at which this context was assembled.
     */
    generatedAt?: number;
    /**
     * Approved glossary terms attached to the asset (asset-level and field/column-level).
     */
    glossaryTerms?: KnowledgeItem[];
    /**
     * Metrics associated with the asset.
     */
    metrics?: KnowledgeItem[];
    /**
     * Runtime signals (profiled shape + data-quality standing) for query construction and
     * answer qualification.
     */
    observability?: Observability;
    /**
     * Canonical URI of the asset this context describes (the OKF `resource` frontmatter key).
     */
    resource?: string;
    /**
     * Classification tags and tier applied to the asset (tag fully qualified names).
     */
    tags?: string[];
    /**
     * Immediate upstream lineage (fully qualified names).
     */
    upstream?: string[];
}

/**
 * A single piece of business knowledge attached to the asset (glossary term definition,
 * metric definition, or Context Center article/pill).
 */
export interface KnowledgeItem {
    /**
     * The definition, business rule, metric expression, or article body for this item. May be a
     * bounded lead excerpt when contentTruncated is true, or null when omitted to stay within
     * the context budget.
     */
    content?: string;
    /**
     * True when content is a lead excerpt or has been omitted to fit the context budget; fetch
     * the full body via the get_knowledge_content tool using this item's fullyQualifiedName.
     */
    contentTruncated?:   boolean;
    displayName?:        string;
    fullyQualifiedName?: string;
    name?:               string;
    /**
     * The entity type of the knowledge item.
     */
    type?: Type;
}

/**
 * The entity type of the knowledge item.
 */
export enum Type {
    ContextMemory = "contextMemory",
    GlossaryTerm = "glossaryTerm",
    Metric = "metric",
    Page = "page",
}

/**
 * Type-specific structural context for the asset.
 *
 * Type-specific structural context. Exactly one sub-context is populated, selected by the
 * asset's entity type. New asset types are added as new optional sub-contexts here without
 * breaking existing consumers.
 */
export interface AssetContext {
    dashboard?: DashboardContext;
    generic?:   GenericAssetContext;
    pipeline?:  PipelineContext;
    table?:     TableContext;
    topic?:     TopicContext;
}

/**
 * Dashboard-specific context: the charts it renders, its data models, and the tables it is
 * ultimately backed by.
 */
export interface DashboardContext {
    /**
     * Fully qualified names of the charts on this dashboard.
     */
    charts?: string[];
    /**
     * Fully qualified names of the data models backing this dashboard.
     */
    dataModels?: string[];
    project?:    string;
    /**
     * Fully qualified names of upstream tables that feed this dashboard.
     */
    sourceTables?: string[];
}

/**
 * Fallback structural context for asset types without a dedicated context (container,
 * mlmodel, searchIndex, storedProcedure, apiEndpoint, ...). Holds the asset's
 * fields/columns and an optional definition (DDL, code, or query).
 */
export interface GenericAssetContext {
    /**
     * DDL, stored-procedure code, or query text backing this asset, when available.
     */
    definition?: string;
    fields?:     FieldContext[];
    /**
     * Fully qualified names of upstream assets, when known.
     */
    sourceAssets?: string[];
}

/**
 * Compact, query-relevant description of a field. Reused across the columnar/field-bearing
 * asset types (table columns, topic schema fields, search-index fields, ML features,
 * container columns, API request/response fields).
 */
export interface FieldContext {
    /**
     * Field-level constraint (e.g. PRIMARY_KEY, NOT_NULL), when applicable.
     */
    constraint?:  string;
    dataType?:    string;
    description?: string;
    name?:        string;
}

/**
 * Pipeline-specific context: its tasks and the assets it reads from and writes to.
 */
export interface PipelineContext {
    scheduleInterval?: string;
    /**
     * Fully qualified names of assets this pipeline writes to.
     */
    sinkAssets?: string[];
    /**
     * Fully qualified names of assets this pipeline reads from.
     */
    sourceAssets?: string[];
    tasks?:        FieldContext[];
}

/**
 * Table-specific structural context (schema, keys, joins) that gives strong signals for SQL
 * generation.
 */
export interface TableContext {
    columns?:       FieldContext[];
    foreignKeys?:   ForeignKey[];
    frequentJoins?: JoinHint[];
    /**
     * Column names the table is partitioned on.
     */
    partitionColumns?: string[];
    /**
     * Column names forming the primary key.
     */
    primaryKey?: string[];
    /**
     * DDL for tables and views, when available.
     */
    schemaDefinition?: string;
}

/**
 * A foreign-key relationship derived from a table's constraints. Provides explicit join
 * keys to other tables.
 */
export interface ForeignKey {
    /**
     * Local column names participating in the foreign key.
     */
    columns?: string[];
    /**
     * Fully qualified names of the referenced columns in the parent table(s).
     */
    referredColumns?: string[];
    /**
     * Cardinality of the relationship (e.g. MANY_TO_ONE).
     */
    relationshipType?: string;
}

/**
 * An empirical join between a column of this table and a column of another table, derived
 * from observed query usage. A strong, data-driven signal for how tables are joined in
 * practice.
 */
export interface JoinHint {
    /**
     * Local column name on this table.
     */
    column?: string;
    /**
     * Number of observed joins over the recorded window.
     */
    joinCount?: number;
    /**
     * Fully qualified name of the column this column is frequently joined with.
     */
    joinedWith?: string;
}

/**
 * Topic-specific context: its message schema and partitioning.
 */
export interface TopicContext {
    cleanupPolicies?: string[];
    partitions?:      number;
    schemaFields?:    FieldContext[];
    schemaType?:      string;
}

/**
 * Runtime signals (profiled shape + data-quality standing) for query construction and
 * answer qualification.
 *
 * Runtime signals about the asset: its profiled shape (for constructing accurate queries)
 * and its data-quality/incident standing (for qualifying answers). Volatile — assembled on
 * read, not part of the semantic embedding.
 */
export interface Observability {
    columnProfiles?: ColumnProfileSummary[];
    dataQuality?:    DataQuality;
    /**
     * Timestamp of the latest profile run.
     */
    profiledAt?: number;
    /**
     * Latest profiled row count.
     */
    rowCount?: number;
}

/**
 * Latest profiled shape of a column: the signals an LLM needs to write accurate filters
 * (null ratio, cardinality, observed value bounds).
 */
export interface ColumnProfileSummary {
    /**
     * Number of distinct values observed.
     */
    distinctCount?: number;
    /**
     * Observed maximum value (numeric/date columns).
     */
    max?: string;
    /**
     * Observed minimum value (numeric/date columns).
     */
    min?:  string;
    name?: string;
    /**
     * Fraction of rows where this column is null (0..1).
     */
    nullProportion?: number;
}

/**
 * Data-quality standing of the asset, so an agent can caveat its answer when tests are
 * failing or an incident is open.
 */
export interface DataQuality {
    aborted?: number;
    failed?:  number;
    /**
     * Number of currently-open (unresolved) data-quality incidents on the asset.
     */
    openIncidents?: number;
    passed?:        number;
    total?:         number;
}
