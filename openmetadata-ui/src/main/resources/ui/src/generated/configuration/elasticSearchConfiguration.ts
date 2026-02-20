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
    searchIndexMappingLanguage:   SearchIndexMappingLanguage;
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
     * The provider to use for generating vector embeddings (e.g., bedrock, openai).
     */
    embeddingProvider?: string;
    /**
     * Enable or disable natural language search
     */
    enabled?: boolean;
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
     * Bedrock model identifier to use for query transformation
     */
    modelId?: string;
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
 * This enum defines the search Type elastic/open search.
 */
export enum SearchType {
    Elasticsearch = "elasticsearch",
    Opensearch = "opensearch",
}
