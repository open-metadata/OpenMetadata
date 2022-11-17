---
title: metadataToElasticSearchPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/metadatatoelasticsearchpipeline
---

# MetadataToElasticSearchPipeline

*Data Insight Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/metadataToESConfigType*. Default: `MetadataToElasticSearch`.
- **`useSSL`** *(boolean)*: Indicates whether to use SSL when connecting to ElasticSearch. By default, we will ignore SSL settings. Default: `False`.
- **`verifyCerts`** *(boolean)*: Indicates whether to verify certificates when using SSL connection to ElasticSearch. Ignored by default. Is set to true, make sure to send the certificates in the property `CA Certificates`. Default: `False`.
- **`timeout`** *(integer)*: Connection Timeout. Default: `30`.
- **`caCerts`** *(string)*: Certificate path to be added in configuration. The path should be local in the Ingestion Container. Default: `None`.
- **`useAwsCredentials`** *(boolean)*: Indicates whether to use aws credentials when connecting to OpenSearch in AWS. Default: `False`.
- **`regionName`** *(string)*: Region name. Required when using AWS Credentials. Default: `None`.
## Definitions

- **`metadataToESConfigType`** *(string)*: Pipeline Source Config Metadata Pipeline type. Must be one of: `['MetadataToElasticSearch']`. Default: `MetadataToElasticSearch`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
