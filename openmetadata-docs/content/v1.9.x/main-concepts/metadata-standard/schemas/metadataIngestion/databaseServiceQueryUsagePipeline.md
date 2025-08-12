---
title: databaseServiceQueryUsagePipeline | Official Documentation
description: Connect Databaseservicequeryusagepipeline to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseservicequeryusagepipeline
---

# DatabaseServiceQueryUsagePipeline

*DatabaseService Query Usage Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/databaseUsageConfigType](#definitions/databaseUsageConfigType)*. Default: `"DatabaseUsage"`.
- **`queryLogDuration`** *(integer)*: Configuration to tune how far we want to look back in query logs to process usage data. Default: `1`.
- **`stageFileLocation`** *(string)*: Temporary file name to store the query logs before processing. Absolute file path required. Default: `"/tmp/query_log"`.
- **`filterCondition`** *(string)*: Configuration the condition to filter the query history.
- **`resultLimit`** *(integer)*: Configuration to set the limit for query logs. Default: `1000`.
- **`queryLogFilePath`** *(string)*: Configuration to set the file path for query logs.
## Definitions

- **`databaseUsageConfigType`** *(string)*: Database Source Config Usage Pipeline type. Must be one of: `["DatabaseUsage"]`. Default: `"DatabaseUsage"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
