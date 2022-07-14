---
title: databaseServiceQueryUsagePipeline
slug: /main-concepts/metadata-standard/schemas/metadataIngestion/databaseservicequeryusagepipeline
---

# DatabaseServiceQueryUsagePipeline

*DatabaseService Query Usage Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/databaseUsageConfigType*. Default: `DatabaseUsage`.
- **`queryLogDuration`** *(integer)*: Configuration to tune how far we want to look back in query logs to process usage data. Default: `1`.
- **`stageFileLocation`** *(string)*: Temporary file name to store the query logs before processing. Absolute file path required. Default: `/tmp/query_log`.
- **`resultLimit`** *(integer)*: Configuration to set the limit for query logs. Default: `100`.
- **`queryLogFilePath`** *(string)*: Configuration to set the file path for query logs.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
## Definitions

- **`databaseUsageConfigType`** *(string)*: Database Source Config Usage Pipeline type. Must be one of: `['DatabaseUsage']`. Default: `DatabaseUsage`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
