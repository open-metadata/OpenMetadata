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
- **`sslConfig`**: Refer to *../common/sslConfig.json*.
- **`connectionTimeoutSecs`** *(integer)*: Connection Timeout in Seconds. Default: `30`.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`searchIndexFilterPattern`**: Regex to only fetch search indexes that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`elasticSearchType`** *(string)*: ElasticSearch service type. Must be one of: `['ElasticSearch']`. Default: `ElasticSearch`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
