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
 * This schema defines the Search Configuration, including ranking logic and other settings
 * per asset type.
 */
export interface SearchSettings {
    /**
     * List of search configurations for each asset type.
     */
    assetTypeConfigurations?: AssetTypeConfiguration[];
    /**
     * Default search configuration when an entity doesn't match.
     */
    defaultConfiguration?: AssetTypeConfiguration;
    /**
     * Flag to enable or disable the RBAC Search Configuration.
     */
    enableAccessControl?: boolean;
    /**
     * Global settings for search.
     */
    globalSettings?: GlobalSettings;
}

/**
 * Defines the search configuration for a specific asset type.
 *
 * Default search configuration when an entity doesn't match.
 */
export interface AssetTypeConfiguration {
    /**
     * Additional settings specific to the asset type.
     */
    additionalSettings?: { [key: string]: any };
    /**
     * List of aggregations to include in the search query.
     */
    aggregations?: Aggregation[];
    /**
     * The type of data asset this configuration applies to.
     */
    assetType: string;
    /**
     * Determines how the combined score and the query score are combined.
     */
    boostMode?: BoostMode;
    /**
     * Boost factors for specific fields.
     */
    boosts?: FieldBoost[];
    /**
     * Fields to search with their boosts.
     */
    fields: { [key: string]: number };
    /**
     * Boost factors based on field values with function modifiers.
     */
    fieldValueBoosts?: FieldValueBoost[];
    /**
     * Fields to include in the highlights.
     */
    highlightFields?: string[];
    /**
     * Fields that must match in the search query.
     */
    mustMatch?: string[];
    /**
     * Fields that must not match.
     */
    mustNotMatch?: string[];
    /**
     * Determines how the computed scores are combined.
     */
    scoreMode?: ScoreMode;
    /**
     * Fields that should match in the search query.
     */
    shouldMatch?: string[];
    /**
     * Boost factors for specific tags.
     */
    tagBoosts?: TagBoost[];
}

/**
 * Defines an aggregation for the search query.
 */
export interface Aggregation {
    /**
     * The field to aggregate on.
     */
    field: string;
    /**
     * The name of the aggregation.
     */
    name: string;
    /**
     * The type of aggregation.
     */
    type: Type;
}

/**
 * The type of aggregation.
 */
export enum Type {
    Avg = "avg",
    DateHistogram = "date_histogram",
    Filters = "filters",
    Histogram = "histogram",
    Max = "max",
    Min = "min",
    Missing = "missing",
    Nested = "nested",
    Range = "range",
    ReverseNested = "reverse_nested",
    Stats = "stats",
    Sum = "sum",
    Terms = "terms",
    TopHits = "top_hits",
}

/**
 * Determines how the combined score and the query score are combined.
 */
export enum BoostMode {
    Avg = "avg",
    Max = "max",
    Min = "min",
    Multiply = "multiply",
    Replace = "replace",
    Sum = "sum",
}

export interface FieldBoost {
    /**
     * Boost factor for the field.
     */
    boost: number;
    /**
     * Field name to boost.
     */
    field: string;
}

export interface FieldValueBoost {
    /**
     * Condition to apply the boost.
     */
    condition?: Condition;
    /**
     * Factor by which to multiply the field value.
     */
    factor: number;
    /**
     * Field name whose value is used for boosting.
     */
    field: string;
    /**
     * Value to use if the field is missing.
     */
    missing?: number;
    /**
     * Modifier function to apply to the field value.
     */
    modifier?: Modifier;
}

/**
 * Condition to apply the boost.
 */
export interface Condition {
    range?: Range;
}

export interface Range {
    /**
     * Greater than value.
     */
    gt?: number;
    /**
     * Greater than or equal to value.
     */
    gte?: number;
    /**
     * Less than value.
     */
    lt?: number;
    /**
     * Less than or equal to value.
     */
    lte?: number;
}

/**
 * Modifier function to apply to the field value.
 */
export enum Modifier {
    Ln = "ln",
    Ln1P = "ln1p",
    Ln2P = "ln2p",
    Log = "log",
    Log1P = "log1p",
    Log2P = "log2p",
    None = "none",
    Reciprocal = "reciprocal",
    Sqrt = "sqrt",
    Square = "square",
}

/**
 * Determines how the computed scores are combined.
 */
export enum ScoreMode {
    Avg = "avg",
    First = "first",
    Max = "max",
    Min = "min",
    Multiply = "multiply",
    Sum = "sum",
}

export interface TagBoost {
    /**
     * Boost factor for the tag.
     */
    boost: number;
    /**
     * Fully Qualified Name of the tag.
     */
    tagFQN: string;
}

/**
 * Global settings for search.
 */
export interface GlobalSettings {
    /**
     * List of aggregations to include in the search query.
     */
    aggregations?: Aggregation[];
    /**
     * Boost factors based on field values with function modifiers (applied globally).
     */
    fieldValueBoosts?: FieldValueBoost[];
    /**
     * Fields to include in the highlights.
     */
    highlightFields?:   string[];
    maxAggregateSize?:  number;
    maxAnalyzedOffset?: number;
    maxResultHits?:     number;
    /**
     * Boost factors for specific tags (applied globally).
     */
    tagBoosts?: TagBoost[];
}
