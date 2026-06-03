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
     * AWS Bedrock configuration for natural language processing
     */
    bedrock?: Bedrock;
    /**
     * Embedding generation using Deep Java Library (DJL)
     */
    djl?: Djl;
    /**
     * The provider to use for generating vector embeddings (e.g., bedrock, openai, google, djl).
     */
    embeddingProvider?: string;
    /**
     * Enable or disable natural language search
     */
    enabled?: boolean;
    /**
     * NLQ filter extractor cache and prompt tuning.
     */
    filterExtractor?: FilterExtractor;
    /**
     * Google Gemini configuration for embedding generation via the Generative Language API.
     */
    google?: Google;
    /**
     * Hybrid search runtime tuning combining BM25 keyword and KNN semantic queries.
     */
    hybridSearch?: HybridSearch;
    /**
     * Weight for BM25 keyword search results in hybrid RRF pipeline (0.0-1.0)
     */
    keywordWeight?: number;
    /**
     * Maximum number of concurrent embedding and NLQ provider requests. Controls the semaphore
     * used to throttle calls to the providers and prevent overwhelming HTTP/2 connection limits.
     */
    maxConcurrentRequests?: number;
    /**
     * OpenAI configuration for embedding generation. Supports both OpenAI and Azure OpenAI
     * endpoints.
     */
    openai?: Openai;
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
 * AWS Bedrock configuration for natural language processing
 */
export interface Bedrock {
    /**
     * AWS credentials configuration for Bedrock service
     */
    awsConfig?: AWSBaseConfig;
    /**
     * Dimension of the embedding vector
     */
    embeddingDimension?: number;
    /**
     * Bedrock embedding model identifier to use for vector search
     */
    embeddingModelId?: string;
    /**
     * Maximum tokens the Bedrock model is allowed to generate.
     */
    maxTokens?: number;
    /**
     * Bedrock model identifier to use for query transformation
     */
    modelId?: string;
    /**
     * Sampling temperature for Bedrock requests.
     */
    temperature?: number;
    /**
     * Bedrock InvokeModel API call timeout in seconds.
     */
    timeoutSeconds?: number;
}

/**
 * AWS credentials configuration for Bedrock service
 *
 * Base AWS configuration for authentication. Supports static credentials, IAM roles, and
 * default credential provider chain.
 */
export interface AWSBaseConfig {
    /**
     * AWS Access Key ID. Falls back to default credential provider chain if not set.
     */
    accessKeyId?: string;
    /**
     * ARN of IAM role to assume for cross-account access.
     */
    assumeRoleArn?: string;
    /**
     * Session name for assumed role.
     */
    assumeRoleSessionName?: string;
    /**
     * Enable AWS IAM authentication. When enabled, uses the default credential provider chain
     * (environment variables, instance profile, etc.). Defaults to false for backward
     * compatibility.
     */
    enabled?: boolean;
    /**
     * Custom endpoint URL for AWS-compatible services (MinIO, LocalStack).
     */
    endpointUrl?: string;
    /**
     * AWS Region (e.g., us-east-1). Required when AWS authentication is enabled.
     */
    region?: string;
    /**
     * AWS Secret Access Key. Falls back to default credential provider chain if not set.
     */
    secretAccessKey?: string;
    /**
     * AWS Session Token for temporary credentials.
     */
    sessionToken?: string;
}

/**
 * Embedding generation using Deep Java Library (DJL)
 */
export interface Djl {
    /**
     * DJL model name for embedding generation
     */
    embeddingModel?: string;
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
}

/**
 * Google Gemini configuration for embedding generation via the Generative Language API.
 */
export interface Google {
    /**
     * API key from Google AI Studio for authenticating with the Generative Language API.
     */
    apiKey?: string;
    /**
     * Dimension of the embedding vector, sent to Google as `outputDimensionality`. For
     * `gemini-embedding-001` valid values are 768, 1536, or 3072. For `text-embedding-004` use
     * 768.
     */
    embeddingDimension?: number;
    /**
     * Gemini embedding model identifier (e.g., gemini-embedding-001, text-embedding-004).
     */
    embeddingModelId?: string;
    /**
     * Optional override for the full embedding endpoint URL. Must be the complete URL including
     * the model and `:embedContent` action (e.g.
     * `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`),
     * not just a base URL. Leave empty to use the default Generative Language API endpoint,
     * which is constructed from `embeddingModelId`. The `key` query parameter is appended
     * automatically.
     */
    endpoint?: string;
    /**
     * Gemini chat model identifier for query transformation (e.g., gemini-2.5-flash,
     * gemini-1.5-flash).
     */
    modelId?: string;
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
 * OpenAI configuration for embedding generation. Supports both OpenAI and Azure OpenAI
 * endpoints.
 */
export interface Openai {
    /**
     * API key for authenticating with OpenAI or Azure OpenAI.
     */
    apiKey?: string;
    /**
     * Azure OpenAI API version. Only used with Azure OpenAI.
     */
    apiVersion?: string;
    /**
     * Azure OpenAI deployment name. Required when using Azure OpenAI.
     */
    deploymentName?: string;
    /**
     * Dimension of the embedding vector. Default is 1536 for text-embedding-3-small.
     */
    embeddingDimension?: number;
    /**
     * OpenAI embedding model identifier (e.g., text-embedding-3-small, text-embedding-ada-002).
     */
    embeddingModelId?: string;
    /**
     * Custom endpoint URL. For Azure OpenAI, use the Azure resource endpoint (e.g.,
     * https://your-resource.openai.azure.com). Leave empty for standard OpenAI API.
     */
    endpoint?: string;
    /**
     * Maximum tokens the OpenAI model is allowed to generate.
     */
    maxTokens?: number;
    /**
     * OpenAI model identifier to use for query transformation (chat completions).
     */
    modelId?: string;
    /**
     * Sampling temperature for OpenAI requests.
     */
    temperature?: number;
    /**
     * OpenAI HTTP request and connect timeout in seconds.
     */
    timeoutSeconds?: number;
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
