---
title: prestoConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/prestoconnection
---

# PrestoConnection

*Presto Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/prestoType*. Default: `Presto`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/prestoScheme*. Default: `presto`.
- **`username`** *(string)*: Username to connect to Presto. This user should have privileges to read all the metadata in Postgres.
- **`password`** *(string)*: Password to connect to Presto.
- **`hostPort`** *(string)*: Host and port of the Presto service.
- **`databaseSchema`** *(string)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`catalog`** *(string)*: Presto catalog.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
## Definitions

- **`prestoType`** *(string)*: Service type. Must be one of: `['Presto']`. Default: `Presto`.
- **`prestoScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['presto']`. Default: `presto`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
