---
title: redshiftConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/redshiftconnection
---

# RedshiftConnection

*Redshift  Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/redshiftType*. Default: `Redshift`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/redshiftScheme*. Default: `redshift+psycopg2`.
- **`username`** *(string)*: Username to connect to Redshift. This user should have privileges to read all the metadata in Redshift.
- **`password`** *(string)*: Password to connect to Redshift.
- **`hostPort`** *(string)*: Host and port of the Redshift service.
- **`database`** *(string)*: Initial Redshift database to connect to. If you want to ingest all databases, set ingestAllDatabases to true.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Redshift. You can use databaseFilterPattern on top of this. Default: `False`.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*. Default: `{'includes': [], 'excludes': ['^information_schema$']}`.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*. Default: `{'includes': [], 'excludes': ['^template1$']}`.
- **`sslMode`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslMode*.
- **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsIncrementalMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsIncrementalMetadataExtraction*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`supportsSystemProfile`**: Refer to *../connectionBasicType.json#/definitions/supportsSystemProfile*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
- **`supportsDataDiff`**: Refer to *../connectionBasicType.json#/definitions/supportsDataDiff*.
## Definitions

- **`redshiftType`** *(string)*: Service type. Must be one of: `['Redshift']`. Default: `Redshift`.
- **`redshiftScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['redshift+psycopg2']`. Default: `redshift+psycopg2`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
