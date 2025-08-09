---
title: openSearchConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/search/opensearchconnection
---

# OpenSearchConnection

*OpenSearch Connection Config*

## Properties

- **`type`**: OpenSearch Type. Refer to *#/definitions/openSearchType*. Default: `OpenSearch`.
- **`hostPort`** *(string)*: Host and port of the OpenSearch service.
- **`authType`**: Choose Auth Config Type.
- **`verifySSL`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL*. Default: `no-ssl`.
- **`sslConfig`**: Refer to *../common/sslConfig.json*.
- **`connectionTimeoutSecs`** *(integer)*: Connection Timeout in Seconds. Default: `30`.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`searchIndexFilterPattern`**: Regex to only fetch search indexes that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`openSearchType`** *(string)*: OpenSearch service type. Must be one of: `['OpenSearch']`. Default: `OpenSearch`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
