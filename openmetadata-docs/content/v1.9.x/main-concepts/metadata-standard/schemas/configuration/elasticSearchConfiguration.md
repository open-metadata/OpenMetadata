---
title: Elasticsearchconfiguration | Official Documentation
description: Connect Elasticsearchconfiguration to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/configuration/elasticsearchconfiguration
---

# ElasticSearchConfiguration

*This schema defines the Elastic Search Configuration.*

## Properties

- **`host`** *(string)*: Elastic Search Host.
- **`port`** *(integer)*: Elastic Search port.
- **`scheme`** *(string)*: Http/Https connection scheme.
- **`username`** *(string)*: Elastic Search Username for Login.
- **`password`** *(string)*: Elastic Search Password for Login.
- **`truststorePath`** *(string)*: Truststore Path.
- **`truststorePassword`** *(string)*: Truststore Password.
- **`connectionTimeoutSecs`** *(integer)*: Connection Timeout in Seconds. Default: `5`.
- **`socketTimeoutSecs`** *(integer)*: Socket Timeout in Seconds. Default: `60`.
- **`keepAliveTimeoutSecs`** *(integer)*: Keep Alive Timeout in Seconds.
- **`batchSize`** *(integer)*: Batch Size for Requests. Default: `10`.
- **`payLoadSize`** *(integer)*: Payload size in bytes depending on elasticsearch config. Default: `10485760`.
- **`clusterAlias`** *(string)*: Alias for search indexes to provide segregation of indexes. Default: `null`.
- **`searchIndexMappingLanguage`**: Refer to *[#/definitions/searchIndexMappingLanguage](#definitions/searchIndexMappingLanguage)*.
- **`searchType`** *(string)*: This enum defines the search Type elastic/open search. Must be one of: `["elasticsearch", "opensearch"]`. Default: `"elasticsearch"`.
- **`searchIndexFactoryClassName`** *(string)*: Index factory name.
## Definitions

- **`searchIndexMappingLanguage`** *(string)*: This schema defines the language options available for search index mappings. Must be one of: `["EN", "JP", "ZH"]`. Default: `"EN"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
