---
title: dbtPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/dbtpipeline
---

# dbtPipeline

*DBT Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/dbtConfigType](#definitions/dbtConfigType)*. Default: `"DBT"`.
- **`dbtConfigSource`**: Available sources to fetch DBT catalog and manifest files.
  - **One of**
    - : Refer to *[./dbtconfig/dbtCloudConfig.json](#dbtconfig/dbtCloudConfig.json)*.
    - : Refer to *[./dbtconfig/dbtLocalConfig.json](#dbtconfig/dbtLocalConfig.json)*.
    - : Refer to *[./dbtconfig/dbtHttpConfig.json](#dbtconfig/dbtHttpConfig.json)*.
    - : Refer to *[./dbtconfig/dbtS3Config.json](#dbtconfig/dbtS3Config.json)*.
    - : Refer to *[./dbtconfig/dbtGCSConfig.json](#dbtconfig/dbtGCSConfig.json)*.
    - : Refer to *[./dbtconfig/dbtAzureConfig.json](#dbtconfig/dbtAzureConfig.json)*.
- **`dbtUpdateDescriptions`** *(boolean)*: Optional configuration to update the description from DBT or not. Default: `false`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `true`.
- **`dbtClassificationName`** *(string)*: Custom OpenMetadata Classification name for dbt tags. Default: `"dbtTags"`.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`parsingTimeoutLimit`** *(integer)*: Configuration to set the timeout for parsing the query in seconds. Default: `300`.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
## Definitions

- <a id="definitions/dbtConfigType"></a>**`dbtConfigType`** *(string)*: DBT Config Pipeline type. Must be one of: `["DBT"]`. Default: `"DBT"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
