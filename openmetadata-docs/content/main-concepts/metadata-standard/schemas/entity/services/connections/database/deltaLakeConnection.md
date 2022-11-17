---
title: deltaLakeConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/deltalakeconnection
---

# DeltaLakeConnection

*DeltaLake Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/deltaLakeType*. Default: `DeltaLake`.
- **`metastoreConnection`**: Hive metastore service, local file path or metastore db.
- **`appName`** *(string)*: pySpark App Name.
- **`connectionArguments`**: Key-Value pairs that will be used to add configs to the SparkSession. Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`deltaLakeType`** *(string)*: Service type. Must be one of: `['DeltaLake']`. Default: `DeltaLake`.
- **`metastoreHostPortConnection`** *(object)*: Cannot contain additional properties.
  - **`metastoreHostPort`** *(string)*: Thrift connection to the metastore service. E.g., localhost:9083.
- **`metastoreDbConnection`** *(object)*: Cannot contain additional properties.
  - **`metastoreDb`** *(string)*: JDBC connection to the metastore database. E.g., jdbc:mysql://localhost:3306/demo_hive.
- **`metastoreFilePathConnection`** *(object)*: Cannot contain additional properties.
  - **`metastoreFilePath`** *(string)*: Local path for the local file with metastore data. E.g., /tmp/metastore.db.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
