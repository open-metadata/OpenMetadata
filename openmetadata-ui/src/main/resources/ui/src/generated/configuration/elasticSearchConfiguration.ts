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
 * This schema defines the Elastic Search Configuration.
 */
export interface ElasticSearchConfiguration {
    /**
     * AWS IAM authentication configuration for OpenSearch. IAM auth must be explicitly enabled.
     * When enabled, uses standard AWS environment variables or configured credentials.
     */
    aws?: Aws;
    /**
     * Batch Size for Requests
     */
    batchSize: number;
    /**
     * Alias for search indexes to provide segregation of indexes.
     */
    clusterAlias?: string;
    /**
     * Connection Timeout in Seconds
     */
    connectionTimeoutSecs: number;
    /**
     * Elastic Search Host. Supports single host or comma-separated list for multiple hosts
     * (e.g., 'localhost' or 'es-node1:9200,es-node2:9200,es-node3:9200').
     */
    host?: string;
    /**
     * Keep Alive Timeout in Seconds
     */
    keepAliveTimeoutSecs?: number;
    /**
     * Maximum connections per host/route in the connection pool
     */
    maxConnPerRoute?: number;
    /**
     * Maximum total connections in the connection pool across all hosts
     */
    maxConnTotal?: number;
    /**
     * Configuration for natural language search capabilities
     */
    naturalLanguageSearch?: NaturalLanguageSearch;
    /**
     * Elastic Search Password for Login
     */
    password?: string;
    /**
     * Payload size in bytes depending on elasticsearch config
     */
    payLoadSize?: number;
    /**
     * Elastic Search port. Used when host does not include port. Ignored when using
     * comma-separated hosts with ports.
     */
    port?: number;
    /**
     * Http/Https connection scheme
     */
    scheme: string;
    /**
     * Index factory name
     */
    searchIndexFactoryClassName?: string;
    /**
     * Limits applied while building search documents so that field values can never be rejected
     * by Elasticsearch/OpenSearch. Values default to the documented engine defaults; override
     * to tune without changing infrastructure settings.
     */
    searchIndexingLimits?:      SearchIndexingLimits;
    searchIndexMappingLanguage: SearchIndexMappingLanguage;
    /**
     * This enum defines the search Type elastic/open search.
     */
    searchType?: SearchType;
    /**
     * Socket Timeout in Seconds
     */
    socketTimeoutSecs: number;
    /**
     * Truststore Password
     */
    truststorePassword?: string;
    /**
     * Truststore Path
     */
    truststorePath?: string;
    /**
     * Elastic Search Username for Login
     */
    username?: string;
}

/**
 * AWS IAM authentication configuration for OpenSearch. IAM auth must be explicitly enabled.
 * When enabled, uses standard AWS environment variables or configured credentials.
 */
export interface Aws {
    /**
     * Enable AWS IAM authentication for OpenSearch. When enabled, requires region to be
     * configured. Defaults to false for backward compatibility.
     */
    enabled?: boolean;
    /**
     * AWS service name for signing (es for Elasticsearch/OpenSearch, aoss for OpenSearch
     * Serverless)
     */
    serviceName?: string;
    [property: string]: any;
}

/**
 * Configuration for natural language search capabilities
 */
export interface NaturalLanguageSearch {
    /**
     * Enable or disable natural language search
     */
    enabled?: boolean;
    /**
     * NLQ filter extractor cache and prompt tuning.
     */
    filterExtractor?: FilterExtractor;
    /**
     * Hybrid search runtime tuning combining BM25 keyword and KNN semantic queries.
     */
    hybridSearch?: HybridSearch;
    /**
     * Weight for BM25 keyword search results in hybrid RRF pipeline (0.0-1.0)
     */
    keywordWeight?: number;
    /**
     * Multiplier applied to k when computing num_candidates for Elasticsearch kNN vector
     * search. num_candidates = max(k * multiplier, 100). Higher values improve recall at the
     * cost of latency. Defaults to 2.
     */
    knnNumCandidatesMultiplier?: number;
    /**
     * Maximum number of concurrent embedding and NLQ provider requests. Controls the semaphore
     * used to throttle calls to the providers and prevent overwhelming HTTP/2 connection limits.
     */
    maxConcurrentRequests?: number;
    /**
     * Fully qualified class name of the NLQService implementation to use
     */
    providerClass?: string;
    /**
     * Enable or disable semantic search using vector embeddings
     */
    semanticSearchEnabled?: boolean;
    /**
     * Weight for semantic vector search results in hybrid RRF pipeline (0.0-1.0)
     */
    semanticWeight?: number;
}

/**
 * NLQ filter extractor cache and prompt tuning.
 */
export interface FilterExtractor {
    /**
     * Cache TTL in minutes for NLQ filter extraction results.
     */
    cacheExpiryMinutes?: number;
    /**
     * Max number of entries in the NLQ filter extraction result cache.
     */
    cacheMaxSize?: number;
    /**
     * Max sample values shown per filter category in the system prompt.
     */
    maxSampleValues?: number;
    /**
     * Maximum tokens the model may generate for NLQ filter extraction.
     */
    maxTokens?: number;
    /**
     * Optional model override for NLQ filter extraction. Leave empty to use the model from
     * llmConfiguration.
     */
    modelId?: string;
    /**
     * Sampling temperature for NLQ filter extraction.
     */
    temperature?: number;
    /**
     * Per-call timeout in seconds for NLQ filter extraction completion.
     */
    timeoutSeconds?: number;
}

/**
 * Hybrid search runtime tuning combining BM25 keyword and KNN semantic queries.
 */
export interface HybridSearch {
    /**
     * Highlight fragment size (characters) for hybrid search hits.
     */
    fragmentSize?: number;
    /**
     * Maximum number of query terms forwarded to the shard-fair keyword sub-query.
     */
    maxQueryTerms?: number;
    /**
     * Pagination depth used by the hybrid query for RRF normalization.
     */
    paginationDepth?: number;
    /**
     * Name of the OpenSearch search pipeline used to normalize hybrid (BM25 + KNN) scores.
     */
    searchPipeline?: string;
    /**
     * Minimum score threshold for the semantic (KNN) sub-query results.
     */
    semanticScoreThreshold?: number;
}

/**
 * This schema defines the language options available for search index mappings.
 */
export enum SearchIndexMappingLanguage {
    En = "EN",
    Jp = "JP",
    Ru = "RU",
    Zh = "ZH",
}

/**
 * Limits applied while building search documents so that field values can never be rejected
 * by Elasticsearch/OpenSearch. Values default to the documented engine defaults; override
 * to tune without changing infrastructure settings.
 */
export interface SearchIndexingLimits {
    /**
     * Enable injecting ignore_above / ignore_malformed and index.mapping.*.limit guardrails
     * into index mappings at creation time so documents cannot be rejected. When false,
     * mappings are created as-is.
     */
    enableMappingHardening?: boolean;
    /**
     * Maximum UTF-8 byte length of a single keyword term. ignore_above is set to a byte-safe
     * character count derived from this (value/4). The hard Lucene limit is 32766 bytes.
     */
    keywordMaxBytes?: number;
    /**
     * Maximum object/column nesting depth. Mirrors index.mapping.depth.limit.
     */
    mappingDepthLimit?: number;
    /**
     * Maximum number of flattened columns or schema fields indexed for a single data asset.
     * Items beyond this are dropped from the search document.
     */
    maxColumns?: number;
    /**
     * Maximum number of nested-type objects allowed in a single document before
     * Elasticsearch/OpenSearch rejects it (the engine rejects rather than truncates). Mirrors
     * index.mapping.nested_objects.limit.
     */
    nestedObjectsLimit?: number;
    /**
     * Maximum total fields per index. Mirrors index.mapping.total_fields.limit.
     */
    totalFieldsLimit?: number;
}

/**
 * This enum defines the search Type elastic/open search.
 */
export enum SearchType {
    Elasticsearch = "elasticsearch",
    Opensearch = "opensearch",
}
