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
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
## Definitions

- **`druidType`** *(string)*: Service type. Must be one of: `['Druid']`. Default: `Druid`.
- **`druidScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['druid']`. Default: `druid`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
