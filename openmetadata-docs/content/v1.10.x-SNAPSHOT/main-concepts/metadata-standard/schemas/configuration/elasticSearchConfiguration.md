---
title: elasticSearchConfiguration
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
- **`clusterAlias`** *(string)*: Alias for search indexes to provide segregation of indexes. Default: `None`.
- **`searchIndexMappingLanguage`**: Refer to *#/definitions/searchIndexMappingLanguage*.
- **`searchType`** *(string)*: This enum defines the search Type elastic/open search. Must be one of: `['elasticsearch', 'opensearch']`. Default: `elasticsearch`.
- **`searchIndexFactoryClassName`** *(string)*: Index factory name.
- **`naturalLanguageSearch`** *(object)*: Configuration for natural language search capabilities. Cannot contain additional properties.
  - **`enabled`** *(boolean)*: Enable or disable natural language search. Default: `False`.
  - **`embeddingProvider`** *(string)*: The provider to use for generating vector embeddings (e.g., bedrock, openai). Default: `bedrock`.
  - **`providerClass`** *(string)*: Fully qualified class name of the NLQService implementation to use. Default: `org.openmetadata.service.search.nlq.NoOpNLQService`.
  - **`bedrock`** *(object)*: AWS Bedrock configuration for natural language processing. Cannot contain additional properties.
    - **`region`** *(string)*: AWS Region for Bedrock service. Default: `us-east-1`.
    - **`modelId`** *(string)*: Bedrock model identifier to use for query transformation. Default: `anthropic.claude-v2`.
    - **`embeddingModelId`** *(string)*: Bedrock embedding model identifier to use for vector search. Default: `amazon.titan-embed-text-v2:0`.
    - **`embeddingDimension`** *(integer)*: Dimension of the embedding vector. Default: `524`.
    - **`accessKey`** *(string)*: AWS access key for Bedrock service authentication.
    - **`secretKey`** *(string)*: AWS secret key for Bedrock service authentication.
    - **`useIamRole`** *(boolean)*: Set to true to use IAM role based authentication instead of access/secret keys. Default: `False`.
## Definitions

- **`searchIndexMappingLanguage`** *(string)*: This schema defines the language options available for search index mappings. Must be one of: `['EN', 'JP', 'ZH']`. Default: `EN`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
