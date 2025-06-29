---
title: greenplumConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/greenplumconnection
---

# GreenplumConnection

*Greenplum Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/greenplumType](#definitions/greenplumType)*. Default: `"Greenplum"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/greenplumScheme](#definitions/greenplumScheme)*. Default: `"postgresql+psycopg2"`.
- **`username`** *(string)*: Username to connect to Greenplum. This user should have privileges to read all the metadata in Greenplum.
- **`authType`**: Choose Auth Config Type.
  - **One of**
    - : Refer to *[./common/basicAuth.json](#common/basicAuth.json)*.
    - : Refer to *[./common/iamAuthConfig.json](#common/iamAuthConfig.json)*.
- **`hostPort`** *(string)*: Host and port of the source service.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`sslMode`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslMode](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslMode)*.
- **`sslConfig`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Greenplum. You can use databaseFilterPattern on top of this. Default: `false`.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsDatabase`**: Refer to *[../connectionBasicType.json#/definitions/supportsDatabase](#/connectionBasicType.json#/definitions/supportsDatabase)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
- **`sampleDataStorageConfig`**: Refer to *[../connectionBasicType.json#/definitions/sampleDataStorageConfig](#/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
- **`supportsViewLineageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsViewLineageExtraction](#/connectionBasicType.json#/definitions/supportsViewLineageExtraction)*.
## Definitions

- **`greenplumType`** *(string)*: Service type. Must be one of: `["Greenplum"]`. Default: `"Greenplum"`.
- **`greenplumScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["postgresql+psycopg2"]`. Default: `"postgresql+psycopg2"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
