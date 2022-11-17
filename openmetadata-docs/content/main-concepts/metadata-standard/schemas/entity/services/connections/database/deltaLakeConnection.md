---
title: deltaLakeConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/deltalakeconnection
---

# DeltaLakeConnection

*DeltaLake Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/deltaLakeType*. Default: `DeltaLake`.
- **`metastoreHostPort`** *(string)*: Host and port of the remote Hive Metastore.
- **`metastoreFilePath`** *(string)*: File path of the local Hive Metastore.
- **`appName`** *(string)*: pySpark App Name.
- **`connectionArguments`**: Key-Value pairs that will be used to add configs to the SparkSession. Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`deltaLakeType`** *(string)*: Service type. Must be one of: `['DeltaLake']`. Default: `DeltaLake`.


Documentation file automatically generated at 2022-09-18 19:21:45.413954.
