---
title: postgresConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/postgresconnection
---

# PostgresConnection

*Postgres Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/postgresType*. Default: `Postgres`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/postgresScheme*. Default: `postgresql+psycopg2`.
- **`username`** *(string)*: Username to connect to Postgres. This user should have privileges to read all the metadata in Postgres.
- **`authType`**: Choose Auth Config Type.
- **`hostPort`** *(string)*: Host and port of the source service.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Postgres. You can use databaseFilterPattern on top of this. Default: `False`.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*. Default: `{'includes': [], 'excludes': ['^information_schema$']}`.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*. Default: `{'includes': [], 'excludes': ['^template1$', '^template0$']}`.
- **`sslMode`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslMode*.
- **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`classificationName`** *(string)*: Custom OpenMetadata Classification name for Postgres policy tags. Default: `PostgresPolicyTags`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
- **`supportsDataDiff`**: Refer to *../connectionBasicType.json#/definitions/supportsDataDiff*.
## Definitions

- **`postgresType`** *(string)*: Service type. Must be one of: `['Postgres']`. Default: `Postgres`.
- **`postgresScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['postgresql+psycopg2', 'pgspider+psycopg2']`. Default: `postgresql+psycopg2`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
