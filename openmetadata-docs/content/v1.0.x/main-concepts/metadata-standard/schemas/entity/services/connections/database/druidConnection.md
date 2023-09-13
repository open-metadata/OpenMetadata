---
title: druidConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/druidconnection
---

# DruidConnection

*Druid Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/druidType*. Default: `Druid`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/druidScheme*. Default: `druid`.
- **`username`** *(string)*: Username to connect to Druid. This user should have privileges to read all the metadata in Druid.
- **`password`** *(string)*: Password to connect to Druid.
- **`hostPort`** *(string)*: Host and port of the Druid service.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`druidType`** *(string)*: Service type. Must be one of: `['Druid']`. Default: `Druid`.
- **`druidScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['druid']`. Default: `druid`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
