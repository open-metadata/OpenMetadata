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
- **`password`** *(string)*: Password to connect to Trino.
- **`hostPort`** *(string)*: Host and port of the Trino service.
- **`catalog`** *(string)*: Catalog of the data source.
- **`databaseSchema`** *(string)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`proxies`** *(object)*: Proxies for the connection to Trino data source. Can contain additional properties.
  - **Additional Properties** *(string)*
- **`params`** *(object)*: URL parameters for connection to the Trino data source. Can contain additional properties.
  - **Additional Properties** *(string)*
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`trinoType`** *(string)*: Service type. Must be one of: `['Trino']`. Default: `Trino`.
- **`trinoScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['trino']`. Default: `trino`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
