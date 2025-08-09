---
title: cacheConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/cacheconfiguration
---

# CacheConfiguration

*This schema defines the Cache Configuration for Redis/ElastiCache/Azure Cache for distributed relationship caching.*

## Properties

- **`enabled`** *(boolean)*: Enable/disable the cache layer. Default: `False`.
- **`provider`**: Refer to *#/definitions/cacheProvider*.
- **`host`** *(string)*: Redis host / cluster endpoint.
- **`port`** *(integer)*: Redis port number. Default: `6379`.
- **`authType`**: Refer to *#/definitions/authType*.
- **`password`** *(string)*: Auth password / key (used when authType is PASSWORD).
- **`useSsl`** *(boolean)*: Use SSL/TLS for Redis connection. Default: `False`.
- **`database`** *(integer)*: Redis database number (not applicable for cluster mode). Minimum: `0`. Maximum: `15`. Default: `0`.
- **`ttlSeconds`** *(integer)*: Default TTL for cache entries in seconds (0 = no expiry). Minimum: `0`. Default: `3600`.
- **`connectionTimeoutSecs`** *(integer)*: Connection timeout in seconds. Default: `5`.
- **`socketTimeoutSecs`** *(integer)*: Socket timeout in seconds. Default: `60`.
- **`maxRetries`** *(integer)*: Maximum number of retry attempts. Default: `3`.
- **`warmupEnabled`** *(boolean)*: Enable cache warmup on startup. Default: `True`.
- **`warmupBatchSize`** *(integer)*: Batch size for cache warmup operations. Minimum: `1`. Default: `100`.
- **`warmupThreads`** *(integer)*: Number of threads for cache warmup. Minimum: `1`. Default: `2`.
- **`awsConfig`** *(object)*: AWS-specific configuration for ElastiCache. Cannot contain additional properties.
  - **`region`** *(string)*: AWS region.
  - **`accessKey`** *(string)*: AWS access key (used when authType is PASSWORD for ElastiCache).
  - **`secretKey`** *(string)*: AWS secret key (used when authType is PASSWORD for ElastiCache).
  - **`useIamRole`** *(boolean)*: Set to true to use IAM role based authentication. Default: `False`.
- **`azureConfig`** *(object)*: Azure-specific configuration for Azure Cache for Redis. Cannot contain additional properties.
  - **`resourceGroup`** *(string)*: Azure resource group.
  - **`subscriptionId`** *(string)*: Azure subscription ID.
  - **`useManagedIdentity`** *(boolean)*: Set to true to use Azure Managed Identity authentication. Default: `False`.
## Definitions

- **`cacheProvider`** *(string)*: Cache provider type. Must be one of: `['REDIS_STANDALONE', 'REDIS_CLUSTER', 'ELASTICACHE_STANDALONE', 'ELASTICACHE_CLUSTER', 'AZURE_REDIS']`. Default: `REDIS_STANDALONE`.
- **`authType`** *(string)*: Authentication type for cache connection. Must be one of: `['PASSWORD', 'IAM', 'AZURE_MANAGED_IDENTITY']`. Default: `PASSWORD`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
