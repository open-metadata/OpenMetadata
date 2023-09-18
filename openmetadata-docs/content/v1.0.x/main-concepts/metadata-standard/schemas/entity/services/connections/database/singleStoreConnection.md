---
title: singleStoreConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/singlestoreconnection
---

# SingleStoreConnection

*SingleStore Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/singleStoreType*. Default: `SingleStore`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/singleStoreScheme*. Default: `mysql+pymysql`.
- **`username`** *(string)*: Username to connect to SingleStore. This user should have privileges to read all the metadata in MySQL.
- **`password`** *(string)*: Password to connect to SingleStore.
- **`hostPort`** *(string)*: Host and port of the SingleStore service.
- **`databaseSchema`** *(string)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`singleStoreType`** *(string)*: Service type. Must be one of: `['SingleStore']`. Default: `SingleStore`.
- **`singleStoreScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['mysql+pymysql']`. Default: `mysql+pymysql`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
