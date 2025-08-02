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
 * This schema defines the Elastic Search Configuration.
 */
export interface ElasticSearchConfiguration {
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
     * Elastic Search Host
     */
    host: string;
    /**
     * Keep Alive Timeout in Seconds
     */
    keepAliveTimeoutSecs?: number;
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
     * Elastic Search port
     */
    port: number;
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
 * Configuration for natural language search capabilities
 */
export interface NaturalLanguageSearch {
    /**
     * AWS Bedrock configuration for natural language processing
     */
    bedrock?: Bedrock;
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
