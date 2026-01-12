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
     * AWS IAM authentication configuration for OpenSearch. When useIamAuth is true, requests
     * will be signed using AWS Signature Version 4.
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
 * AWS IAM authentication configuration for OpenSearch. When useIamAuth is true, requests
 * will be signed using AWS Signature Version 4.
 */
export interface Aws {
    /**
     * AWS Access Key ID. If not provided, default credential provider chain will be used.
     */
    accessKeyId?: string;
    /**
     * AWS Region for OpenSearch service
     */
    region?: string;
    /**
     * AWS Secret Access Key. If not provided, default credential provider chain will be used.
     */
    secretAccessKey?: string;
    /**
     * AWS service name for signing (es for Elasticsearch/OpenSearch, aoss for OpenSearch
     * Serverless)
     */
    serviceName?: string;
    /**
     * AWS Session Token for temporary credentials
     */
    sessionToken?: string;
    /**
     * Enable AWS IAM authentication for OpenSearch
     */
    useIamAuth?: boolean;
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
     * Fully qualified class name of the NLQService implementation to use
     */
    providerClass?: string;
}

/**
 * AWS Bedrock configuration for natural language processing
 */
export interface Bedrock {
    /**
     * AWS access key for Bedrock service authentication
     */
    accessKey?: string;
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
    /**
     * AWS Region for Bedrock service
     */
    region?: string;
    /**
     * AWS secret key for Bedrock service authentication
     */
    secretKey?: string;
    /**
     * Set to true to use IAM role based authentication instead of access/secret keys.
     */
    useIamRole?: boolean;
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
