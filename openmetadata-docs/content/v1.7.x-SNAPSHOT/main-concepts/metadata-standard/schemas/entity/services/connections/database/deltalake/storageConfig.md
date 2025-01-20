---
title: storageConfig
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/deltalake/storageconfig
---

# StorageConfig

*DeltaLake Storage Connection Config*

## Properties

- **`connection`**: Available sources to fetch files.
  - **One of**
    - : Refer to *[../datalake/s3Config.json](#/datalake/s3Config.json)*.
- **`bucketName`** *(string)*: Bucket Name of the data source. Default: `""`.
- **`prefix`** *(string)*: Prefix of the data source. Default: `""`.
## Definitions

- **`localConfig`** *(object)*: Local config source where no extra information needs to be sent. Cannot contain additional properties.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
