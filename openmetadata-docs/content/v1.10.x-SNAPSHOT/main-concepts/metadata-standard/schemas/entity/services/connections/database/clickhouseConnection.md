---
title: clickhouseConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/clickhouseconnection
---

# ClickhouseConnection

*Clickhouse Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/clickhouseType*. Default: `Clickhouse`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/clickhouseScheme*. Default: `clickhouse+http`.
- **`username`** *(string)*: Username to connect to Clickhouse. This user should have privileges to read all the metadata in Clickhouse.
- **`password`** *(string)*: Password to connect to Clickhouse.
- **`hostPort`** *(string)*: Host and port of the Clickhouse service.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`duration`** *(integer)*: Clickhouse SQL connection duration.
- **`https`** *(boolean)*: Use HTTPS Protocol for connection with clickhouse.
- **`secure`** *(boolean)*: Establish secure connection with clickhouse.
- **`keyfile`** *(string)*: Path to key file for establishing secure connection.
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
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
## Definitions

- **`clickhouseType`** *(string)*: Service type. Must be one of: `['Clickhouse']`. Default: `Clickhouse`.
- **`clickhouseScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['clickhouse+http', 'clickhouse+native']`. Default: `clickhouse+http`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
