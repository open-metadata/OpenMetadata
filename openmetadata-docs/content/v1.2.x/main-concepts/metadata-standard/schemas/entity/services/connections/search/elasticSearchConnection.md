---
title: elasticSearchConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/search/elasticsearchconnection
---

# ElasticSearch Connection

*ElasticSearch Connection.*

## Properties

- **`type`**: ElasticSearch Type. Refer to *[#/definitions/elasticSearchType](#definitions/elasticSearchType)*. Default: `"ElasticSearch"`.
- **`hostPort`** *(string, format: uri)*: Host and port of the ElasticSearch service.
- **`authType`**: Choose Auth Config Type.
  - **One of**
    - : Refer to *[#/definitions/basicAuthentication](#definitions/basicAuthentication)*.
    - : Refer to *[#/definitions/apiAuthentication](#definitions/apiAuthentication)*.
- **`caCert`** *(string)*: Path to CA Cert File.
- **`connectionTimeoutSecs`** *(integer)*: Connection Timeout in Seconds. Default: `30`.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/elasticSearchType"></a>**`elasticSearchType`** *(string)*: ElasticSearch service type. Must be one of: `["ElasticSearch"]`. Default: `"ElasticSearch"`.
- <a id="definitions/basicAuthentication"></a>**`basicAuthentication`** *(object)*
  - **`username`** *(string)*: Elastic Search Username for Login.
  - **`password`** *(string, format: password)*: Elastic Search Password for Login.
- <a id="definitions/apiAuthentication"></a>**`apiAuthentication`** *(object)*
  - **`apiKey`** *(string, format: password)*: Elastic Search API Key for API Authentication.
  - **`apiKeyId`** *(string)*: Elastic Search API Key ID for API Authentication.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
