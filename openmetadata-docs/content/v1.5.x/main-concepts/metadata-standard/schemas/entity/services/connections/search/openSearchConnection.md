---
title: openSearchConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/search/opensearchconnection
---

# OpenSearch Connection

*OpenSearch Connection.*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/openSearchType*. Default: `OpenSearch`.
- **`hostPort`** *(string)*: Host and port of the OpenSearch service.
- **`scheme`** *(string)*: Http/Https connection scheme.
- **`username`** *(string)*: OpenSearch Username for Login.
- **`password`** *(string)*: OpenSearch Password for Login.
- **`truststorePath`** *(string)*: Truststore Path.
- **`truststorePassword`** *(string)*: Truststore Password.
- **`connectionTimeoutSecs`** *(integer)*: Connection Timeout in Seconds. Default: `5`.
- **`socketTimeoutSecs`** *(integer)*: Socket Timeout in Seconds. Default: `60`.
- **`keepAliveTimeoutSecs`** *(integer)*: Keep Alive Timeout in Seconds.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`openSearchType`** *(string)*: OpenSearch service type. Must be one of: `['OpenSearch']`. Default: `OpenSearch`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
