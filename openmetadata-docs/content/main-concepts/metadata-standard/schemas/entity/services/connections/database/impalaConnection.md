---
title: impalaConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/impalaconnection
---

# ImpalaConnection

*Impala SQL Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/impalaType*. Default: `Impala`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/impalaScheme*. Default: `impala`.
- **`username`** *(string)*: Username to connect to Impala. This user should have privileges to read all the metadata in Impala.
- **`password`** *(string)*: Password to connect to Impala.
- **`hostPort`** *(string)*: Host and port of the Impala service.
- **`databaseSchema`** *(string)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`authOptions`** *(string)*: Authentication options to pass to Impala connector. These options are based on SQLAlchemy.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`impalaType`** *(string)*: Service type. Must be one of: `['Impala']`. Default: `Impala`.
- **`impalaScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['impala']`. Default: `impala`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
