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
- **`s3StagingDir`** *(string)*: S3 Staging Directory. Example: s3://postgres/input/.
- **`workgroup`** *(string)*: Athena workgroup.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`supportsUsageExtraction`** *(boolean)*: Supports Usage Extraction. Default: `True`.
- **`supportsLineageExtraction`** *(boolean)*: Supports Lineage Extraction. Default: `True`.
- **`supportsDataDiff`**: Refer to *../connectionBasicType.json#/definitions/supportsDataDiff*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
## Definitions

- **`athenaType`** *(string)*: Service type. Must be one of: `['Athena']`. Default: `Athena`.
- **`athenaScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['awsathena+rest']`. Default: `awsathena+rest`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
