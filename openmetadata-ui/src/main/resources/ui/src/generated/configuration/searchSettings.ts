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
export interface SearchSettings {
    /**
     * List of per-asset search configurations that override the global settings.
     */
    assetTypeConfigurations?: AssetTypeConfiguration[];
    /**
     * Fallback configuration for any entity/asset not matched in assetTypeConfigurations.
     */
    defaultConfiguration?: AssetTypeConfiguration;
    globalSettings?:       GlobalSettings;
}

/**
 * Fallback configuration for any entity/asset not matched in assetTypeConfigurations.
 */
export interface AssetTypeConfiguration {
    /**
     * Catch-all for any advanced or asset-specific search settings.
     */
    additionalSettings?: { [key: string]: any };
    /**
     * List of additional aggregations for this asset type.
     */
    aggregations?: Aggregation[];
    /**
     * Name or type of the asset to which this configuration applies.
     */
    assetType: string;
    /**
     * How the function score is combined with the main query score.
     */
    boostMode?: BoostMode;
    /**
     * List of numeric field-based boosts that apply only to this asset.
     */
    fieldValueBoosts?: FieldValueBoost[];
    /**
     * Which fields to highlight for this asset.
     */
    highlightFields?: string[];
    /**
     * How to combine function scores if multiple boosts are applied.
     */
    scoreMode?: ScoreMode;
    /**
     * Which fields to search for this asset, with their boost values.
     */
    searchFields?: FieldBoost[];
    /**
     * List of field=value term-boost rules that apply only to this asset.
     */
    termBoosts?: TermBoost[];
}

export interface Aggregation {
    /**
     * The field on which this aggregation is performed.
     */
    field: string;
    /**
     * A descriptive name for the aggregation.
     */
    name: string;
    /**
     * The type of aggregation to perform.
     */
    type: Type;
}

/**
 * The type of aggregation to perform.
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
 * How the function score is combined with the main query score.
 */
export enum BoostMode {
    Avg = "avg",
    Max = "max",
    Min = "min",
    Multiply = "multiply",
    Replace = "replace",
    Sum = "sum",
}

export interface FieldValueBoost {
    /**
     * Conditional logic (e.g., range constraints) to apply the boost only for certain values.
     */
    condition?: Condition;
    /**
     * Multiplier factor for the field value.
     */
    factor: number;
    /**
     * Numeric field name whose value will affect the score.
     */
    field: string;
    /**
     * Value to use if the field is missing on a document.
     */
    missing?: number;
    /**
     * Optional mathematical transformation to apply to the field value.
     */
    modifier?: Modifier;
}

/**
 * Conditional logic (e.g., range constraints) to apply the boost only for certain values.
 */
export interface Condition {
    range?: Range;
}

export interface Range {
    gt?:  number;
    gte?: number;
    lt?:  number;
    lte?: number;
}

/**
 * Optional mathematical transformation to apply to the field value.
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
 * How to combine function scores if multiple boosts are applied.
 */
export enum ScoreMode {
    Avg = "avg",
    First = "first",
    Max = "max",
    Min = "min",
    Multiply = "multiply",
    Sum = "sum",
}

export interface FieldBoost {
    /**
     * Relative boost factor for the above field.
     */
    boost?: number;
    /**
     * Field name to search/boost.
     */
    field: string;
}

export interface TermBoost {
    /**
     * Numeric boost factor to apply if a document has field==value.
     */
    boost: number;
    /**
     * The keyword field to match, e.g. tier.tagFQN, tags.tagFQN, certification.tagLabel.tagFQN,
     * etc.
     */
    field: string;
    /**
     * The exact keyword value to match in the above field.
     */
    value: string;
}

export interface GlobalSettings {
    /**
     * List of global aggregations to include in the search query.
     */
    aggregations?: Aggregation[];
    /**
     * Flag to enable or disable RBAC Search Configuration globally.
     */
    enableAccessControl?: boolean;
    /**
     * Optional list of numeric field-based boosts applied globally.
     */
    fieldValueBoosts?: FieldValueBoost[];
    /**
     * Which fields to highlight by default.
     */
    highlightFields?:   string[];
    maxAggregateSize?:  number;
    maxAnalyzedOffset?: number;
    maxResultHits?:     number;
    /**
     * List of field=value term-boost rules that apply only to this asset.
     */
    termBoosts?: TermBoost[];
}
