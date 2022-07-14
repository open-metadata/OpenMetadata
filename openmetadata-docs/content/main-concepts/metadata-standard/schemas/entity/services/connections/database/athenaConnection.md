---
title: athenaConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/athenaconnection
---

# AthenaConnection

*AWS Athena Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/athenaType*. Default: `Athena`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/athenaScheme*. Default: `awsathena+rest`.
- **`awsConfig`**: Refer to *../../../../security/credentials/awsCredentials.json*.
- **`hostPort`** *(string)*: Host and port of the Athena service.
- **`s3StagingDir`** *(string)*: S3 Staging Directory.
- **`workgroup`** *(string)*: Athena workgroup.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`athenaType`** *(string)*: Service type. Must be one of: `['Athena']`. Default: `Athena`.
- **`athenaScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['awsathena+rest']`. Default: `awsathena+rest`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
