---
title: elasticSearchConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/search/elasticsearchconnection
---

# ElasticSearch Connection

*ElasticSearch Connection.*

## Properties

- **`type`**: ElasticSearch Type. Refer to *#/definitions/elasticSearchType*. Default: `ElasticSearch`.
- **`hostPort`** *(string)*: Host and port of the ElasticSearch service.
- **`authType`**: Choose Auth Config Type.
- **`caCert`** *(string)*: Path to CA Cert File.
- **`connectionTimeoutSecs`** *(integer)*: Connection Timeout in Seconds. Default: `30`.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`elasticSearchType`** *(string)*: ElasticSearch service type. Must be one of: `['ElasticSearch']`. Default: `ElasticSearch`.
- **`basicAuthentication`** *(object)*
  - **`username`** *(string)*: Elastic Search Username for Login.
  - **`password`** *(string)*: Elastic Search Password for Login.
- **`apiAuthentication`** *(object)*
  - **`apiKey`** *(string)*: Elastic Search API Key for API Authentication.
  - **`apiKeyId`** *(string)*: Elastic Search API Key ID for API Authentication.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
