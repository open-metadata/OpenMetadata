---
title: clickhouseConnection
slug: /main-concepts/metadata-standard/schemas/schema/entity/services/connections/database
---

# ClickhouseConnection

*Clickhouse Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/clickhouseType*. Default: `Clickhouse`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/clickhouseScheme*. Default: `clickhouse+http`.
- **`username`** *(string)*: Username to connect to Clickhouse. This user should have privileges to read all the metadata in Clickhouse.
- **`password`** *(string)*: Password to connect to Clickhouse.
- **`hostPort`** *(string)*: Host and port of the Clickhouse service.
- **`databaseSchema`** *(string)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`duration`** *(integer)*: Clickhouse SQL connection duration.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`clickhouseType`** *(string)*: Service type. Must be one of: `['Clickhouse']`. Default: `Clickhouse`.
- **`clickhouseScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['clickhouse+http', 'clickhouse+native']`. Default: `clickhouse+http`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
