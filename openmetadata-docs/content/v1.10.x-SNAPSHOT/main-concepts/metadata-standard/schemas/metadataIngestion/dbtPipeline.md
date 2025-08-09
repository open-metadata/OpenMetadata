---
title: dbtPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/dbtpipeline
---

# dbtPipeline

*DBT Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/dbtConfigType*. Default: `DBT`.
- **`dbtConfigSource`**: Available sources to fetch DBT catalog and manifest files.
- **`searchAcrossDatabases`** *(boolean)*: Optional configuration to search across databases for tables or not. Default: `False`.
- **`dbtUpdateDescriptions`** *(boolean)*: Optional configuration to update the description from DBT or not. Default: `False`.
- **`dbtUpdateOwners`** *(boolean)*: Optional configuration to update the owners from DBT or not. Default: `False`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `True`.
- **`dbtClassificationName`** *(string)*: Custom OpenMetadata Classification name for dbt tags. Default: `dbtTags`.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`parsingTimeoutLimit`** *(integer)*: Configuration to set the timeout for parsing the query in seconds. Default: `300`.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`tagFilterPattern`**: Regex to only fetch tags that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
## Definitions

- **`dbtConfigType`** *(string)*: DBT Config Pipeline type. Must be one of: `['DBT']`. Default: `DBT`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
