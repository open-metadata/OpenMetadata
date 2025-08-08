---
title: datalakeConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/datalakeconnection
---

# DatalakeConnection

*Datalake Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/datalakeType*. Default: `Datalake`.
- **`configSource`**: Available sources to fetch files.
- **`bucketName`** *(string)*: Bucket Name of the data source. Default: ``.
- **`prefix`** *(string)*: Prefix of the data source. Default: ``.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
## Definitions

- **`datalakeType`** *(string)*: Service type. Must be one of: `['Datalake']`. Default: `Datalake`.
- **`localConfig`** *(object)*: Local config source where no extra information needs to be sent. Cannot contain additional properties.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
