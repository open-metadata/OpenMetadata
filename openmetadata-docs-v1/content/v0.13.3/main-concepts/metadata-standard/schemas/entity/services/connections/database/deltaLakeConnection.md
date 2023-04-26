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
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`deltaLakeType`** *(string)*: Service type. Must be one of: `['DeltaLake']`. Default: `DeltaLake`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
