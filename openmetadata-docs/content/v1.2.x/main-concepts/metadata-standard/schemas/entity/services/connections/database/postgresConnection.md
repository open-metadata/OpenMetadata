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
- **`sslMode`**: SSL Mode to connect to postgres database. Must be one of: `['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full']`. Default: `disable`.
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
## Definitions

- **`postgresType`** *(string)*: Service type. Must be one of: `['Postgres']`. Default: `Postgres`.
- **`postgresScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['postgresql+psycopg2', 'pgspider+psycopg2']`. Default: `postgresql+psycopg2`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
