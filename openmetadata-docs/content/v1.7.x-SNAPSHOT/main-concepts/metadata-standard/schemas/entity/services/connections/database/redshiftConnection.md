---
title: redshiftConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/redshiftconnection
---

# RedshiftConnection

*Redshift  Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/redshiftType](#definitions/redshiftType)*. Default: `"Redshift"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/redshiftScheme](#definitions/redshiftScheme)*. Default: `"redshift+psycopg2"`.
- **`username`** *(string)*: Username to connect to Redshift. This user should have privileges to read all the metadata in Redshift.
- **`password`** *(string, format: password)*: Password to connect to Redshift.
- **`hostPort`** *(string)*: Host and port of the Redshift service.
- **`database`** *(string)*: Initial Redshift database to connect to. If you want to ingest all databases, set ingestAllDatabases to true.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Redshift. You can use databaseFilterPattern on top of this. Default: `false`.
- **`sslMode`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslMode](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslMode)*.
- **`sslConfig`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsUsageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsUsageExtraction](#/connectionBasicType.json#/definitions/supportsUsageExtraction)*.
- **`supportsLineageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsLineageExtraction](#/connectionBasicType.json#/definitions/supportsLineageExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsDatabase`**: Refer to *[../connectionBasicType.json#/definitions/supportsDatabase](#/connectionBasicType.json#/definitions/supportsDatabase)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
- **`supportsSystemProfile`**: Refer to *[../connectionBasicType.json#/definitions/supportsSystemProfile](#/connectionBasicType.json#/definitions/supportsSystemProfile)*.
- **`sampleDataStorageConfig`**: Refer to *[../connectionBasicType.json#/definitions/sampleDataStorageConfig](#/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
- **`supportsDataDiff`**: Refer to *[../connectionBasicType.json#/definitions/supportsDataDiff](#/connectionBasicType.json#/definitions/supportsDataDiff)*.
## Definitions

- **`redshiftType`** *(string)*: Service type. Must be one of: `["Redshift"]`. Default: `"Redshift"`.
- **`redshiftScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["redshift+psycopg2"]`. Default: `"redshift+psycopg2"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
