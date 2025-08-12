---
title: databaseServiceAutoClassificationPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseserviceautoclassificationpipeline
---

# DatabaseServiceAutoClassificationPipeline

*DatabaseService AutoClassification & Auto Classification Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/autoClassificationConfigType*. Default: `AutoClassification`.
- **`classificationFilterPattern`**: Regex to only compute metrics for table that matches the given tag, tiers, gloassary pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`includeViews`** *(boolean)*: Optional configuration to turn off fetching metadata for views. Default: `True`.
- **`useFqnForFiltering`** *(boolean)*: Regex will be applied on fully qualified name (e.g service_name.db_name.schema_name.table_name) instead of raw name (e.g. table_name). Default: `False`.
- **`storeSampleData`** *(boolean)*: Option to turn on/off storing sample data. If enabled, we will ingest sample data for each table. Default: `False`.
- **`enableAutoClassification`** *(boolean)*: Optional configuration to automatically tag columns that might contain sensitive information. Default: `True`.
- **`confidence`** *(number)*: Set the Confidence value for which you want the column to be tagged as PII. Confidence value ranges from 0 to 100. A higher number will yield less false positives but more false negatives. A lower number will yield more false positives but less false negatives. Default: `80`.
- **`sampleDataCount`** *(integer)*: Number of sample rows to ingest when 'Generate Sample Data' is enabled. Default: `50`.
## Definitions

- **`autoClassificationConfigType`** *(string)*: Profiler Source Config Pipeline type. Must be one of: `['AutoClassification']`. Default: `AutoClassification`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
