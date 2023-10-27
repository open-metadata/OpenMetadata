---
title: databaseServiceQueryLineagePipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseservicequerylineagepipeline
---

# DatabaseServiceQueryLineagePipeline

*DatabaseService Query Lineage Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/databaseLineageConfigType](#definitions/databaseLineageConfigType)*. Default: `"DatabaseLineage"`.
- **`queryLogDuration`** *(integer)*: Configuration to tune how far we want to look back in query logs to process lineage data. Default: `1`.
- **`queryLogFilePath`** *(string)*: Configuration to set the file path for query logs.
- **`resultLimit`** *(integer)*: Configuration to set the limit for query logs. Default: `1000`.
- **`parsingTimeoutLimit`** *(integer)*: Configuration to set the timeout for parsing the query in seconds. Default: `300`.
- **`filterCondition`** *(string)*: Configuration the condition to filter the query history.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
## Definitions

- <a id="definitions/databaseLineageConfigType"></a>**`databaseLineageConfigType`** *(string)*: Database Source Config Usage Pipeline type. Must be one of: `["DatabaseLineage"]`. Default: `"DatabaseLineage"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
