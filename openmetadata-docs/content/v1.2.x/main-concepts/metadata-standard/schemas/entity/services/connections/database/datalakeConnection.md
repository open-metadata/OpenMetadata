---
title: datalakeConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/datalakeconnection
---

# DatalakeConnection

*Datalake Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/datalakeType](#definitions/datalakeType)*. Default: `"Datalake"`.
- **`configSource`**: Available sources to fetch files.
  - **One of**
    - : Refer to *[#/definitions/localConfig](#definitions/localConfig)*.
    - : Refer to *[datalake/azureConfig.json](#talake/azureConfig.json)*.
    - : Refer to *[datalake/gcsConfig.json](#talake/gcsConfig.json)*.
    - : Refer to *[datalake/s3Config.json](#talake/s3Config.json)*.
- **`bucketName`** *(string)*: Bucket Name of the data source. Default: `""`.
- **`prefix`** *(string)*: Prefix of the data source. Default: `""`.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
## Definitions

- <a id="definitions/datalakeType"></a>**`datalakeType`** *(string)*: Service type. Must be one of: `["Datalake"]`. Default: `"Datalake"`.
- <a id="definitions/localConfig"></a>**`localConfig`** *(object)*: Local config source where no extra information needs to be sent. Cannot contain additional properties.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
