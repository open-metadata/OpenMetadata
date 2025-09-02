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
 * Preview Search Results
 */
export interface PreviewSearchRequest {
    explain?:     boolean;
    fetchSource?: boolean;
    /**
     * Pagination start index.
     */
    from?:                number;
    includeSourceFields?: string[];
    /**
     * The index to run the query against (e.g., table_search_index).
     */
    index:       string;
    postFilter?: string;
    /**
     * The query text to execute against the search index.
     */
    query:          string;
    queryFilter?:   string;
    searchSettings: SearchSettings;
    /**
     * Number of results to return.
     */
    size?:           number;
    sortField?:      string;
    sortOrder?:      SortOrder;
    trackTotalHits?: boolean;
    [property: string]: any;
}

export interface SearchSettings {
    /**
     * Configurations of allowed searchable fields for each entity type
     */
    allowedFields?: AllowedSearchFields[];
    /**
     * Configurations of allowed field value boost fields for each entity type
     */
    allowedFieldValueBoosts?: AllowedFieldValueBoostFields[];
    /**
     * List of per-asset search configurations that override the global settings.
     */
    assetTypeConfigurations?: AssetTypeConfiguration[];
    /**
     * Fallback configuration for any entity/asset not matched in assetTypeConfigurations.
     */
    defaultConfiguration?: AssetTypeConfiguration;
    globalSettings?:       GlobalSettings;
    /**
     * Configuration for Natural Language Query capabilities
     */
    nlqConfiguration?: NlqConfiguration;
}

export interface AllowedFieldValueBoostFields {
    /**
     * Entity type this field value boost configuration applies to
     */
    entityType: string;
    fields:     AllowedFieldValueBoostField[];
}

export interface AllowedFieldValueBoostField {
    /**
     * Detailed explanation of what this numeric field represents and how it can be used for
     * boosting relevance
     */
    description: string;
    /**
     * Field name that can be used in fieldValueBoosts
     */
    name: string;
}

export interface AllowedSearchFields {
    /**
     * Entity type this field configuration applies to
     */
    entityType: string;
    fields:     AllowedFieldField[];
}

export interface AllowedFieldField {
    /**
     * Detailed explanation of what this field represents and how it affects search behavior
     */
    description: string;
    /**
     * Field name that can be used in searchFields
     */
    name: string;
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
     * Multipliers applied to different match types to control their relative importance.
     */
    matchTypeBoostMultipliers?: MatchTypeBoostMultipliers;
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
 * Multipliers applied to different match types to control their relative importance.
 */
export interface MatchTypeBoostMultipliers {
    /**
     * Multiplier for exact match queries (term queries on .keyword fields)
     */
    exactMatchMultiplier?: number;
    /**
     * Multiplier for fuzzy match queries
     */
    fuzzyMatchMultiplier?: number;
    /**
     * Multiplier for phrase match queries
     */
    phraseMatchMultiplier?: number;
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
    /**
     * Type of matching to use for this field. 'exact' uses term query for .keyword fields,
     * 'phrase' uses match_phrase, 'fuzzy' allows fuzzy matching, 'standard' uses the default
     * behavior.
     */
    matchType?: MatchType;
}

/**
 * Type of matching to use for this field. 'exact' uses term query for .keyword fields,
 * 'phrase' uses match_phrase, 'fuzzy' allows fuzzy matching, 'standard' uses the default
 * behavior.
 */
export enum MatchType {
    Exact = "exact",
    Fuzzy = "fuzzy",
    Phrase = "phrase",
    Standard = "standard",
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

/**
 * Configuration for Natural Language Query capabilities
 */
export interface NlqConfiguration {
    entitySpecificInstructions?: EntitySpecificInstruction[];
    examples?:                   QueryExample[];
    /**
     * Guidelines for querying custom properties in extension fields
     */
    extensionFieldGuidelines?: ExtensionFieldGuidelines;
    globalInstructions?:       PromptSection[];
    /**
     * Configuration for including Elasticsearch mapping information in prompts
     */
    mappingConfiguration?: MappingConfiguration;
    /**
     * Base prompt template for the NLQ system. Use {{INSTRUCTIONS}} where entity-specific
     * instructions should appear.
     */
    promptTemplate?: string;
    [property: string]: any;
}

export interface EntitySpecificInstruction {
    /**
     * Entity type this instruction applies to (e.g., 'table', 'dashboard')
     */
    entityType: string;
    sections:   PromptSection[];
    [property: string]: any;
}

export interface PromptSection {
    /**
     * The content for this section of the prompt
     */
    content: string;
    /**
     * Display order for this section (lower numbers appear first)
     */
    order?: number;
    /**
     * Section name (e.g., 'CRITICAL FIELD CORRECTIONS', 'QUERY PATTERNS')
     */
    section: string;
    [property: string]: any;
}

export interface QueryExample {
    /**
     * Human-readable description of the example query
     */
    description?: string;
    /**
     * Entity types this example applies to (empty array = all types)
     */
    entityTypes?: string[];
    /**
     * The corresponding Elasticsearch query
     */
    esQuery: string;
    /**
     * Natural language query example
     */
    query: string;
    [property: string]: any;
}

/**
 * Guidelines for querying custom properties in extension fields
 */
export interface ExtensionFieldGuidelines {
    examples?: QueryExample[];
    /**
     * Title for the extension field guidelines section
     */
    header:   string;
    sections: GuidelineSection[];
    [property: string]: any;
}

export interface GuidelineSection {
    guidelines: string[];
    /**
     * Section title (e.g., 'For EntityReference type custom properties')
     */
    title: string;
    [property: string]: any;
}

/**
 * Configuration for including Elasticsearch mapping information in prompts
 */
export interface MappingConfiguration {
    /**
     * Specific guidance for interpreting field patterns in the mapping
     */
    fieldInterpretations?: FieldInterpretation[];
    /**
     * Whether to include mapping information in the prompts
     */
    includeMappings?: boolean;
    mappingSection?:  TitleSection;
    [property: string]: any;
}

export interface FieldInterpretation {
    /**
     * How to interpret and query this field pattern
     */
    explanation: string;
    /**
     * Field pattern to match (e.g., 'tags.tagFQN')
     */
    pattern: string;
    [property: string]: any;
}

export interface TitleSection {
    /**
     * Description text for the section
     */
    description?: string;
    /**
     * Position of this section in the prompt (lower numbers appear first)
     */
    order?: number;
    /**
     * Title for the section
     */
    title?: string;
    [property: string]: any;
}

export enum SortOrder {
    Asc = "asc",
    Desc = "desc",
}
