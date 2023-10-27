---
title: athenaConnection
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
## Definitions

- <a id="definitions/athenaType"></a>**`athenaType`** *(string)*: Service type. Must be one of: `["Athena"]`. Default: `"Athena"`.
- <a id="definitions/athenaScheme"></a>**`athenaScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["awsathena+rest"]`. Default: `"awsathena+rest"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
