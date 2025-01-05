---
title: gaussdbConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/gaussdbconnection
---

# GaussdbConnection

*Gaussdb Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/gaussdbType*. Default: `Gaussdb`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/gaussdbScheme*. Default: `postgresql+psycopg2`.
- **`username`** *(string)*: Username to connect to Gaussdb. This user should have privileges to read all the metadata in Gaussdb.
- **`authType`**: Choose Auth Config Type.
- **`hostPort`** *(string)*: Host and port of the source service.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Gaussdb. You can use databaseFilterPattern on top of this. Default: `False`.
- **`sslMode`**: SSL Mode to connect to gaussdb database. Must be one of: `['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full']`. Default: `disable`.
- **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`classificationName`** *(string)*: Custom OpenMetadata Classification name for Gaussdb policy tags. Default: `GaussdbPolicyTags`.
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

- **`gaussdbType`** *(string)*: Service type. Must be one of: `['Gaussdb']`. Default: `Gaussdb`.
- **`gaussdbScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['postgresql+psycopg2', 'pgspider+psycopg2']`. Default: `postgresql+psycopg2`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
