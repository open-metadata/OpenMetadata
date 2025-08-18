---
title: DeltaLake Connection | OpenMetadata DeltaLake
description: Get started with deltalakeconnection. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/deltalakeconnection
---

# DeltaLakeConnection

*DeltaLake Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/deltaLakeType](#definitions/deltaLakeType)*. Default: `"DeltaLake"`.
- **`configSource`**: Available sources to fetch the metadata.
  - **One of**
    - : Refer to *[./deltalake/metastoreConfig.json](#deltalake/metastoreConfig.json)*.
    - : Refer to *[./deltalake/storageConfig.json](#deltalake/storageConfig.json)*.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionArguments`**: If using Metastore, Key-Value pairs that will be used to add configs to the SparkSession. Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
## Definitions

- **`deltaLakeType`** *(string)*: Service type. Must be one of: `["DeltaLake"]`. Default: `"DeltaLake"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
