---
title: mysqlConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/mysqlconnection
---

# MysqlConnection

*Mysql Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/mySQLType](#definitions/mySQLType)*. Default: `"Mysql"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/mySQLScheme](#definitions/mySQLScheme)*. Default: `"mysql+pymysql"`.
- **`username`** *(string)*: Username to connect to MySQL. This user should have privileges to read all the metadata in Mysql.
- **`authType`**: Choose Auth Config Type.
  - **One of**
    - : Refer to *[./common/basicAuth.json](#common/basicAuth.json)*.
    - : Refer to *[./common/iamAuthConfig.json](#common/iamAuthConfig.json)*.
- **`hostPort`** *(string)*: Host and port of the MySQL service.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`sslCA`** *(string)*: Provide the path to ssl ca file.
- **`sslCert`** *(string)*: Provide the path to ssl client certificate file (ssl_cert).
- **`sslKey`** *(string)*: Provide the path to ssl client certificate file (ssl_key).
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
## Definitions

- <a id="definitions/mySQLType"></a>**`mySQLType`** *(string)*: Service type. Must be one of: `["Mysql"]`. Default: `"Mysql"`.
- <a id="definitions/mySQLScheme"></a>**`mySQLScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["mysql+pymysql"]`. Default: `"mysql+pymysql"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
