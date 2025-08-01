---
title: alationSinkConnection | Official Documentation
description: Setup schema for connecting to Alation Sink metadata services, enabling metadata push and sync with Alation platform.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/metadata/alationsinkconnection
---

# AlationSinkConnection

*Alation Sink Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/alationSinkType](#definitions/alationSinkType)*. Default: `"AlationSink"`.
- **`hostPort`** *(string, format: uri)*: Host and port of the Alation service.
- **`authType`**: Types of methods used to authenticate to the alation instance.
  - **One of**
    - : Refer to *[../../../../security/credentials/basicAuth.json](#/../../../security/credentials/basicAuth.json)*.
    - : Refer to *[../../../../security/credentials/apiAccessTokenAuth.json](#/../../../security/credentials/apiAccessTokenAuth.json)*.
- **`projectName`** *(string)*: Project name to create the refreshToken. Can be anything. Default: `"AlationAPI"`.
- **`paginationLimit`** *(integer)*: Pagination limit used for Alation APIs pagination. Default: `10`.
- **`datasourceLinks`**: Refer to *[#/definitions/datasourceLinks](#definitions/datasourceLinks)*.
- **`verifySSL`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL](#/../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL)*. Default: `"no-ssl"`.
- **`sslConfig`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`alationSinkType`** *(string)*: Service type. Must be one of: `["AlationSink"]`. Default: `"AlationSink"`.
- **`datasourceLinks`** *(object)*: Add the links between alation datasources and OpenMetadata Database services. Can contain additional properties.
  - **Additional Properties** *(string)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
