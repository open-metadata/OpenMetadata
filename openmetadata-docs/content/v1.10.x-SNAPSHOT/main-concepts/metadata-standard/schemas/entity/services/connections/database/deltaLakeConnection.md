---
title: deltaLakeConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/deltalakeconnection
---

# DeltaLakeConnection

*DeltaLake Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/deltaLakeType*. Default: `DeltaLake`.
- **`configSource`**: Available sources to fetch the metadata.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionArguments`**: If using Metastore, Key-Value pairs that will be used to add configs to the SparkSession. Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
## Definitions

- **`deltaLakeType`** *(string)*: Service type. Must be one of: `['DeltaLake']`. Default: `DeltaLake`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
