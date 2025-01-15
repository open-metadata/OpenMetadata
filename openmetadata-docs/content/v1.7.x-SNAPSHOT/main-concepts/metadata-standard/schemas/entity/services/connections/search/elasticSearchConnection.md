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
    - : Refer to *[./elasticSearch/basicAuth.json](#elasticSearch/basicAuth.json)*.
    - : Refer to *[./elasticSearch/apiAuth.json](#elasticSearch/apiAuth.json)*.
- **`sslConfig`**: Refer to *[../common/sslConfig.json](#/common/sslConfig.json)*.
- **`connectionTimeoutSecs`** *(integer)*: Connection Timeout in Seconds. Default: `30`.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`elasticSearchType`** *(string)*: ElasticSearch service type. Must be one of: `["ElasticSearch"]`. Default: `"ElasticSearch"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
