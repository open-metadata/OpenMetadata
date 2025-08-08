---
title: trinoConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/trinoconnection
---

# TrinoConnection

*Trino Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/trinoType*. Default: `Trino`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/trinoScheme*. Default: `trino`.
- **`username`** *(string)*: Username to connect to Trino. This user should have privileges to read all the metadata in Trino.
- **`authType`**: Choose Auth Config Type.
- **`hostPort`** *(string)*: Host and port of the Trino service.
- **`catalog`** *(string)*: Catalog of the data source.
- **`databaseSchema`** *(string)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`proxies`** *(object)*: Proxies for the connection to Trino data source. Can contain additional properties.
  - **Additional Properties** *(string)*
- **`verify`** *(string)*: Verify ( Connection Argument for SSL ) to connect to Trino.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
- **`supportsDataDiff`**: Refer to *../connectionBasicType.json#/definitions/supportsDataDiff*.
- **`queryHistoryTable`** *(string)*: Table name to fetch the query history. Default: `"system"."runtime"."queries"`.
## Definitions

- **`trinoType`** *(string)*: Service type. Must be one of: `['Trino']`. Default: `Trino`.
- **`trinoScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['trino']`. Default: `trino`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
