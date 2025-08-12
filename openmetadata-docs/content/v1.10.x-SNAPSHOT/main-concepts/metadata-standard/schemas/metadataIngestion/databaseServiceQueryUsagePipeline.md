---
title: databaseServiceQueryUsagePipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseservicequeryusagepipeline
---

# DatabaseServiceQueryUsagePipeline

*DatabaseService Query Usage Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/databaseUsageConfigType*. Default: `DatabaseUsage`.
- **`queryLogDuration`** *(integer)*: Configuration to tune how far we want to look back in query logs to process usage data. Default: `1`.
- **`stageFileLocation`** *(string)*: Temporary file name to store the query logs before processing. Absolute file path required. Default: `/tmp/query_log`.
- **`filterCondition`** *(string)*: Configuration the condition to filter the query history.
- **`resultLimit`** *(integer)*: Configuration to set the limit for query logs. Default: `1000`.
- **`queryLogFilePath`** *(string)*: Configuration to set the file path for query logs.
- **`processQueryCostAnalysis`** *(boolean)*: Configuration to process query cost. Default: `True`.
## Definitions

- **`databaseUsageConfigType`** *(string)*: Database Source Config Usage Pipeline type. Must be one of: `['DatabaseUsage']`. Default: `DatabaseUsage`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
