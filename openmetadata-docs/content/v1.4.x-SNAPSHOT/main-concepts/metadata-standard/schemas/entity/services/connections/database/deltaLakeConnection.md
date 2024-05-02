---
title: deltaLakeConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/deltalakeconnection
---

# DeltaLakeConnection

*DeltaLake Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/deltaLakeType*. Default: `DeltaLake`.
- **`metastoreConnection`**: Hive metastore service, local file path or metastore db.
- **`appName`** *(string)*: pySpark App Name. Default: `OpenMetadata`.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionArguments`**: Key-Value pairs that will be used to add configs to the SparkSession. Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
## Definitions

- **`deltaLakeType`** *(string)*: Service type. Must be one of: `['DeltaLake']`. Default: `DeltaLake`.
- **`metastoreHostPortConnection`** *(object)*: Cannot contain additional properties.
  - **`metastoreHostPort`** *(string)*: Thrift connection to the metastore service. E.g., localhost:9083.
- **`metastoreDbConnection`** *(object)*: Cannot contain additional properties.
  - **`metastoreDb`** *(string)*: JDBC connection to the metastore database. E.g., jdbc:mysql://localhost:3306/demo_hive.
  - **`username`** *(string)*: Username to use against metastore database. The value will be mapped as spark.hadoop.javax.jdo.option.ConnectionUserName sparks property.
  - **`password`** *(string)*: Password to use against metastore database. The value will be mapped as spark.hadoop.javax.jdo.option.ConnectionPassword sparks property.
  - **`driverName`** *(string)*: Driver class name for JDBC metastore. The value will be mapped as spark.hadoop.javax.jdo.option.ConnectionDriverName sparks property. E.g., org.mariadb.jdbc.Driver.
  - **`jdbcDriverClassPath`** *(string)*: Class path to JDBC driver required for JDBC connection. The value will be mapped as spark.driver.extraClassPath sparks property.
- **`metastoreFilePathConnection`** *(object)*: Cannot contain additional properties.
  - **`metastoreFilePath`** *(string)*: Local path for the local file with metastore data. E.g., /tmp/metastore.db.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
