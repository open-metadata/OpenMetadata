---
title: greenplumConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/greenplumconnection
---

# GreenplumConnection

*Greenplum Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/greenplumType*. Default: `Greenplum`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/greenplumScheme*. Default: `postgresql+psycopg2`.
- **`username`** *(string)*: Username to connect to Greenplum. This user should have privileges to read all the metadata in Greenplum.
- **`authType`**: Choose Auth Config Type.
- **`hostPort`** *(string)*: Host and port of the source service.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`sslMode`**: SSL Mode to connect to Greenplum database. Must be one of: `['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full']`. Default: `disable`.
- **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Greenplum. You can use databaseFilterPattern on top of this. Default: `False`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`greenplumType`** *(string)*: Service type. Must be one of: `['Greenplum']`. Default: `Greenplum`.
- **`greenplumScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['postgresql+psycopg2']`. Default: `postgresql+psycopg2`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
