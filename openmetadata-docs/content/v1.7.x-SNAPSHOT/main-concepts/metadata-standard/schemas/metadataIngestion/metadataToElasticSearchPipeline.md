---
title: metadataToElasticSearchPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/metadatatoelasticsearchpipeline
---

# MetadataToElasticSearchPipeline

*Data Insight Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/metadataToESConfigType](#definitions/metadataToESConfigType)*. Default: `"MetadataToElasticSearch"`.
- **`regionName`** *(string)*: Region name. Required when using AWS Credentials. Default: `null`.
- **`caCerts`** *(string)*: Certificate path to be added in configuration. The path should be local in the Ingestion Container. Default: `null`.
- **`timeout`** *(integer)*: Connection Timeout. Default: `30`.
- **`useSSL`** *(boolean)*: Indicates whether to use SSL when connecting to ElasticSearch. By default, we will ignore SSL settings. Default: `false`.
- **`verifyCerts`** *(boolean)*: Indicates whether to verify certificates when using SSL connection to ElasticSearch. Ignored by default. Is set to true, make sure to send the certificates in the property `CA Certificates`. Default: `false`.
- **`useAwsCredentials`** *(boolean)*: Indicates whether to use aws credentials when connecting to OpenSearch in AWS. Default: `false`.
- **`searchIndexMappingLanguage`**: Recreate Indexes with updated Language. Refer to *[../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage](#/configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage)*.
- **`batchSize`** *(integer)*: Maximum number of events entities in a batch (Default 1000). Default: `1000`.
- **`recreateIndex`** *(boolean)*: Default: `true`.
## Definitions

- **`metadataToESConfigType`** *(string)*: Pipeline Source Config Metadata Pipeline type. Must be one of: `["MetadataToElasticSearch"]`. Default: `"MetadataToElasticSearch"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
