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
 * This schema defines the Cache Configuration for Redis/ElastiCache/Azure Cache for
 * distributed relationship caching.
 */
export interface CacheConfiguration {
    authType?: AuthType;
    /**
     * AWS-specific configuration for ElastiCache
     */
    awsConfig?: AwsConfig;
    /**
     * Azure-specific configuration for Azure Cache for Redis
     */
    azureConfig?: AzureConfig;
    /**
     * Connection timeout in seconds
     */
    connectionTimeoutSecs?: number;
    /**
     * Redis database number (not applicable for cluster mode)
     */
    database?: number;
    /**
     * Enable/disable the cache layer
     */
    enabled: boolean;
    /**
     * Redis host / cluster endpoint
     */
    host?: string;
    /**
     * Maximum number of retry attempts
     */
    maxRetries?: number;
    /**
     * Auth password / key (used when authType is PASSWORD)
     */
    password?: string;
    /**
     * Redis port number
     */
    port?:     number;
    provider?: CacheProvider;
    /**
     * Socket timeout in seconds
     */
    socketTimeoutSecs?: number;
    /**
     * Default TTL for cache entries in seconds (0 = no expiry)
     */
    ttlSeconds?: number;
    /**
     * Use SSL/TLS for Redis connection
     */
    useSsl?: boolean;
    /**
     * Batch size for cache warmup operations
     */
    warmupBatchSize?: number;
    /**
     * Enable cache warmup on startup
     */
    warmupEnabled?: boolean;
    /**
     * Number of threads for cache warmup
     */
    warmupThreads?: number;
}

/**
 * Authentication type for cache connection
 */
export enum AuthType {
    AzureManagedIdentity = "AZURE_MANAGED_IDENTITY",
    Iam = "IAM",
    Password = "PASSWORD",
}

/**
 * AWS-specific configuration for ElastiCache
 */
export interface AwsConfig {
    /**
     * AWS access key (used when authType is PASSWORD for ElastiCache)
     */
    accessKey?: string;
    /**
     * AWS region
     */
    region?: string;
    /**
     * AWS secret key (used when authType is PASSWORD for ElastiCache)
     */
    secretKey?: string;
    /**
     * Set to true to use IAM role based authentication
     */
    useIamRole?: boolean;
}

/**
 * Azure-specific configuration for Azure Cache for Redis
 */
export interface AzureConfig {
    /**
     * Azure resource group
     */
    resourceGroup?: string;
    /**
     * Azure subscription ID
     */
    subscriptionId?: string;
    /**
     * Set to true to use Azure Managed Identity authentication
     */
    useManagedIdentity?: boolean;
}

/**
 * Cache provider type
 */
export enum CacheProvider {
    AzureRedis = "AZURE_REDIS",
    ElasticacheCluster = "ELASTICACHE_CLUSTER",
    ElasticacheStandalone = "ELASTICACHE_STANDALONE",
    RedisCluster = "REDIS_CLUSTER",
    RedisStandalone = "REDIS_STANDALONE",
}
