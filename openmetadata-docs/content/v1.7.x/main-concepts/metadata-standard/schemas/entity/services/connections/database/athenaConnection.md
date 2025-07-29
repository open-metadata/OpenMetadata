---
title: Athena Connection | OpenMetadata Athena Connection Details
description: Configure Athena connection using this schema to ingest query execution metadata from Amazon Athena.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/athenaconnection
---

# AthenaConnection

*AWS Athena Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/athenaType](#definitions/athenaType)*. Default: `"Athena"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/athenaScheme](#definitions/athenaScheme)*. Default: `"awsathena+rest"`.
- **`awsConfig`**: Refer to *[../../../../security/credentials/awsCredentials.json](#/../../../security/credentials/awsCredentials.json)*.
- **`s3StagingDir`** *(string, format: uri)*: S3 Staging Directory. Example: s3://postgres/input/.
- **`workgroup`** *(string)*: Athena workgroup.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
- **`supportsUsageExtraction`** *(boolean)*: Supports Usage Extraction. Default: `true`.
- **`supportsLineageExtraction`** *(boolean)*: Supports Lineage Extraction. Default: `true`.
- **`supportsDataDiff`**: Refer to *[../connectionBasicType.json#/definitions/supportsDataDiff](#/connectionBasicType.json#/definitions/supportsDataDiff)*.
- **`sampleDataStorageConfig`**: Refer to *[../connectionBasicType.json#/definitions/sampleDataStorageConfig](#/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
## Definitions

- **`athenaType`** *(string)*: Service type. Must be one of: `["Athena"]`. Default: `"Athena"`.
- **`athenaScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["awsathena+rest"]`. Default: `"awsathena+rest"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
