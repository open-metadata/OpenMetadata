---
title: alationSinkConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/alationsinkconnection
---

# AlationSinkConnection

*Alation Sink Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/alationSinkType*. Default: `AlationSink`.
- **`hostPort`** *(string)*: Host and port of the Alation service.
- **`authType`**: Types of methods used to authenticate to the alation instance.
- **`projectName`** *(string)*: Project name to create the refreshToken. Can be anything. Default: `AlationAPI`.
- **`paginationLimit`** *(integer)*: Pagination limit used for Alation APIs pagination. Default: `10`.
- **`datasourceLinks`**: Refer to *#/definitions/datasourceLinks*.
- **`verifySSL`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL*. Default: `no-ssl`.
- **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`alationSinkType`** *(string)*: Service type. Must be one of: `['AlationSink']`. Default: `AlationSink`.
- **`datasourceLinks`** *(object)*: Add the links between alation datasources and OpenMetadata Database services. Can contain additional properties.
  - **Additional Properties** *(string)*


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
