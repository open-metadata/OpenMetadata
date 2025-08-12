---
title: Cockroach Connection | OpenMetadata Cockroach
description: Get started with cockroachconnection. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/cockroachconnection
---

# CockroachConnection

*Cockroach Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/cockroachType](#definitions/cockroachType)*. Default: `"Cockroach"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/cockroachScheme](#definitions/cockroachScheme)*. Default: `"cockroachdb+psycopg2"`.
- **`username`** *(string)*: Username to connect to Cockroach. This user should have privileges to read all the metadata in Cockroach.
- **`authType`**: Choose Auth Config Type.
  - **One of**
    - : Refer to *[./common/basicAuth.json](#common/basicAuth.json)*.
- **`hostPort`** *(string)*: Host and port of the Cockrooach service.
- **`database`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Postgres. You can use databaseFilterPattern on top of this. Default: `false`.
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`sslConfig`**: SSL Configuration details. Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`sslMode`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslMode](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslMode)*.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
## Definitions

- **`cockroachType`** *(string)*: Service type. Must be one of: `["Cockroach"]`. Default: `"Cockroach"`.
- **`cockroachScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["cockroachdb+psycopg2"]`. Default: `"cockroachdb+psycopg2"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
