---
title: metadataToElasticSearchPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/metadatatoelasticsearchpipeline
---

# MetadataToElasticSearchPipeline

*Data Insight Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/metadataToESConfigType*. Default: `MetadataToElasticSearch`.
- **`regionName`** *(string)*: Region name. Required when using AWS Credentials. Default: `None`.
- **`caCerts`** *(string)*: Certificate path to be added in configuration. The path should be local in the Ingestion Container. Default: `None`.
- **`timeout`** *(integer)*: Connection Timeout. Default: `30`.
- **`useSSL`** *(boolean)*: Indicates whether to use SSL when connecting to ElasticSearch. By default, we will ignore SSL settings. Default: `False`.
- **`verifyCerts`** *(boolean)*: Indicates whether to verify certificates when using SSL connection to ElasticSearch. Ignored by default. Is set to true, make sure to send the certificates in the property `CA Certificates`. Default: `False`.
- **`useAwsCredentials`** *(boolean)*: Indicates whether to use aws credentials when connecting to OpenSearch in AWS. Default: `False`.
- **`searchIndexMappingLanguage`**: Recreate Indexes with updated Language. Refer to *../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage*.
- **`batchSize`** *(integer)*: Maximum number of events entities in a batch (Default 1000). Default: `1000`.
- **`recreateIndex`** *(boolean)*: Default: `True`.
## Definitions

- **`metadataToESConfigType`** *(string)*: Pipeline Source Config Metadata Pipeline type. Must be one of: `['MetadataToElasticSearch']`. Default: `MetadataToElasticSearch`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
