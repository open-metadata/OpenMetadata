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
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`connectionTimeout`** *(integer)*: The maximum amount of time (in seconds) to wait for a successful connection to the data source. If the connection attempt takes longer than this timeout period, an error will be returned. Default: `120`.
- **`queryHistoryTable`** *(string)*: Table name to fetch the query history. Default: `system.query.history`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*. Default: `{'includes': [], 'excludes': ['^information_schema$']}`.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*. Default: `{'includes': [], 'excludes': ['^system$']}`.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
## Definitions

- **`databricksType`** *(string)*: Service type. Must be one of: `['Databricks']`. Default: `Databricks`.
- **`databricksScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['databricks+connector']`. Default: `databricks+connector`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
