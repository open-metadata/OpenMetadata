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
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`mariaDBType`** *(string)*: Service type. Must be one of: `['MariaDB']`. Default: `MariaDB`.
- **`mariaDBScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['mysql+pymysql']`. Default: `mysql+pymysql`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
