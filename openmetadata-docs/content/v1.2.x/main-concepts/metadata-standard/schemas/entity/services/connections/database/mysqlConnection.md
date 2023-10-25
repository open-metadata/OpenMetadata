---
title: mysqlConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/mysqlconnection
---

# MysqlConnection

*Mysql Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/mySQLType*. Default: `Mysql`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/mySQLScheme*. Default: `mysql+pymysql`.
- **`username`** *(string)*: Username to connect to MySQL. This user should have privileges to read all the metadata in Mysql.
- **`authType`**: Choose Auth Config Type.
- **`hostPort`** *(string)*: Host and port of the MySQL service.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`sslCA`** *(string)*: Provide the path to ssl ca file.
- **`sslCert`** *(string)*: Provide the path to ssl client certificate file (ssl_cert).
- **`sslKey`** *(string)*: Provide the path to ssl client certificate file (ssl_key).
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`mySQLType`** *(string)*: Service type. Must be one of: `['Mysql']`. Default: `Mysql`.
- **`mySQLScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['mysql+pymysql']`. Default: `mysql+pymysql`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
