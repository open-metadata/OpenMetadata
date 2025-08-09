---
title: metastoreConfig
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/deltalake/metastoreconfig
---

# MetastoreConfig

*Deltalake Metastore configuration.*

## Properties

- **`connection`**: Metastore connection configuration, depending on your metastore type.
- **`appName`** *(string)*: pySpark App Name. Default: `OpenMetadata`.
## Definitions

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


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
