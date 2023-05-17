---
title: pinotDBConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/pinotdbconnection
---

# PinotDBConnection

*PinotDB Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/pinotDBType*. Default: `PinotDB`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/pinotDBScheme*. Default: `pinot`.
- **`username`** *(string)*: username to connect  to the PinotDB. This user should have privileges to read all the metadata in PinotDB.
- **`password`** *(string)*: password to connect  to the PinotDB.
- **`hostPort`** *(string)*: Host and port of the PinotDB service.
- **`pinotControllerHost`** *(string)*: Pinot Broker Host and Port of the data source.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`pinotDBType`** *(string)*: Service type. Must be one of: `['PinotDB']`. Default: `PinotDB`.
- **`pinotDBScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['pinot', 'pinot+http', 'pinot+https']`. Default: `pinot`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
