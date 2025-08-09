---
title: databaseServiceQueryLineagePipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseservicequerylineagepipeline
---

# DatabaseServiceQueryLineagePipeline

*DatabaseService Query Lineage Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/databaseLineageConfigType*. Default: `DatabaseLineage`.
- **`queryLogDuration`** *(integer)*: Configuration to tune how far we want to look back in query logs to process lineage data. Default: `1`.
- **`queryLogFilePath`** *(string)*: Configuration to set the file path for query logs.
- **`resultLimit`** *(integer)*: Configuration to set the limit for query logs. Default: `1000`.
- **`parsingTimeoutLimit`** *(integer)*: Configuration to set the timeout for parsing the query in seconds. Default: `300`.
- **`filterCondition`** *(string)*: Configuration the condition to filter the query history.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`storedProcedureFilterPattern`**: Regex to only fetch stored procedures that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`overrideViewLineage`** *(boolean)*: Set the 'Override View Lineage' toggle to control whether to override the existing view lineage. Default: `False`.
- **`processViewLineage`** *(boolean)*: Set the 'Process View Lineage' toggle to control whether to process view lineage. Default: `True`.
- **`processQueryLineage`** *(boolean)*: Set the 'Process Query Lineage' toggle to control whether to process query lineage. Default: `True`.
- **`processStoredProcedureLineage`** *(boolean)*: Set the 'Process Stored ProcedureLog Lineage' toggle to control whether to process stored procedure lineage. Default: `True`.
- **`threads`** *(integer)*: Number of Threads to use in order to parallelize lineage ingestion. Minimum: `1`. Default: `1`.
- **`processCrossDatabaseLineage`** *(boolean)*: Set the 'Process Cross Database Lineage' toggle to control whether to process table lineage across different databases. Default: `False`.
- **`crossDatabaseServiceNames`** *(array)*: Set 'Cross Database Service Names' to process lineage with the database.
  - **Items** *(string)*
- **`enableTempTableLineage`** *(boolean)*: Handle Lineage for Snowflake Temporary and Transient Tables. . Default: `False`.
- **`incrementalLineageProcessing`** *(boolean)*: Set the 'Incremental Lineage Processing' toggle to control whether to process lineage incrementally. Default: `True`.
## Definitions

- **`databaseLineageConfigType`** *(string)*: Database Source Config Usage Pipeline type. Must be one of: `['DatabaseLineage']`. Default: `DatabaseLineage`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
