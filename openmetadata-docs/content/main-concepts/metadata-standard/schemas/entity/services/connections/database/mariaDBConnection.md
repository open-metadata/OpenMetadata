---
title: mariaDBConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/mariadbconnection
---

# MariaDBConnection

*MariaDB Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/mariaDBType*. Default: `MariaDB`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/mariaDBScheme*. Default: `mysql+pymysql`.
- **`username`** *(string)*: Username to connect to MariaDB. This user should have privileges to read all the metadata in MariaDB.
- **`password`** *(string)*: Password to connect to MariaDB.
- **`hostPort`** *(string)*: Host and port of the MariaDB service.
- **`databaseSchema`** *(string)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`mariaDBType`** *(string)*: Service type. Must be one of: `['MariaDB']`. Default: `MariaDB`.
- **`mariaDBScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['mysql+pymysql']`. Default: `mysql+pymysql`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
