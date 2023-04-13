---
title: databricksConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/databricksconnection
---

# DatabricksConnection

*Databricks Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/databricksType*. Default: `Databricks`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/databricksScheme*. Default: `databricks+connector`.
- **`hostPort`** *(string)*: Host and port of the Databricks service.
- **`token`** *(string)*: Generated Token to connect to Databricks.
- **`httpPath`** *(string)*: Databricks compute resources URL.
- **`catalog`** *(string)*: Catalog of the data source(Example: hive_metastore). This is optional parameter, if you would like to restrict the metadata reading to a single catalog. When left blank, OpenMetadata Ingestion attempts to scan all the catalog.
- **`databaseSchema`** *(string)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`connectionTimeout`** *(integer)*: The maximum amount of time (in seconds) to wait for a successful connection to the data source. If the connection attempt takes longer than this timeout period, an error will be returned. Default: `120`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`databricksType`** *(string)*: Service type. Must be one of: `['Databricks']`. Default: `Databricks`.
- **`databricksScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['databricks+connector']`. Default: `databricks+connector`.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
