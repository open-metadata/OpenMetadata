---
title: openSearchConnection | Official Documentation
description: Define OpenSearch connection configurations to enable metadata search and indexing with scalable, reliable search operations.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/search/opensearchconnection
---

# OpenSearch Connection

*OpenSearch Connection.*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/openSearchType](#definitions/openSearchType)*. Default: `"OpenSearch"`.
- **`hostPort`** *(string)*: Host and port of the OpenSearch service.
- **`scheme`** *(string)*: Http/Https connection scheme.
- **`username`** *(string)*: OpenSearch Username for Login.
- **`password`** *(string)*: OpenSearch Password for Login.
- **`truststorePath`** *(string)*: Truststore Path.
- **`truststorePassword`** *(string)*: Truststore Password.
- **`connectionTimeoutSecs`** *(integer)*: Connection Timeout in Seconds. Default: `5`.
- **`socketTimeoutSecs`** *(integer)*: Socket Timeout in Seconds. Default: `60`.
- **`keepAliveTimeoutSecs`** *(integer)*: Keep Alive Timeout in Seconds.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`openSearchType`** *(string)*: OpenSearch service type. Must be one of: `["OpenSearch"]`. Default: `"OpenSearch"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
