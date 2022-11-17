---
title: databaseServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseservicemetadatapipeline
---

# DatabaseServiceMetadataPipeline

*DatabaseService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/databaseMetadataConfigType*. Default: `DatabaseMetadata`.
- **`markDeletedTables`** *(boolean)*: Optional configuration to soft delete tables in OpenMetadata if the source tables are deleted. Default: `True`.
- **`markDeletedTablesFromFilterOnly`** *(boolean)*: Optional configuration to mark deleted tables only to the filtered schema. Default: `False`.
- **`includeTables`** *(boolean)*: Optional configuration to turn off fetching metadata for tables. Default: `True`.
- **`includeViews`** *(boolean)*: Optional configuration to turn off fetching metadata for views. Default: `True`.
- **`includeTags`** *(boolean)*: Optional configuration to turn off fetching metadata for tags. Default: `True`.
- **`useFqnForFiltering`** *(boolean)*: Regex will be applied on fully qualified name (e.g service_name.db_name.schema_name.table_name) instead of raw name (e.g. table_name). Default: `False`.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`dbtConfigSource`**: Available sources to fetch DBT catalog and manifest files.
## Definitions

- **`databaseMetadataConfigType`** *(string)*: Database Source Config Metadata Pipeline type. Must be one of: `['DatabaseMetadata']`. Default: `DatabaseMetadata`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
