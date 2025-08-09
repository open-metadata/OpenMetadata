---
title: cockroachConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/cockroachconnection
---

# CockroachConnection

*Cockroach Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/cockroachType*. Default: `Cockroach`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/cockroachScheme*. Default: `cockroachdb+psycopg2`.
- **`username`** *(string)*: Username to connect to Cockroach. This user should have privileges to read all the metadata in Cockroach.
- **`authType`**: Choose Auth Config Type.
- **`hostPort`** *(string)*: Host and port of the Cockrooach service.
- **`database`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Postgres. You can use databaseFilterPattern on top of this. Default: `False`.
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`sslConfig`**: SSL Configuration details. Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`sslMode`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslMode*.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`cockroachType`** *(string)*: Service type. Must be one of: `['Cockroach']`. Default: `Cockroach`.
- **`cockroachScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['cockroachdb+psycopg2']`. Default: `cockroachdb+psycopg2`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
