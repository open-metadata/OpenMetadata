---
title: databaseServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseservicemetadatapipeline
---

# DatabaseServiceMetadataPipeline

*DatabaseService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/databaseMetadataConfigType](#definitions/databaseMetadataConfigType)*. Default: `"DatabaseMetadata"`.
- **`markDeletedTables`** *(boolean)*: This is an optional configuration for enabling soft deletion of tables. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply solely to the schema that is currently being ingested via the pipeline. Any related entities such as test suites or lineage information that were associated with those tables will also be deleted. Default: `true`.
- **`includeTables`** *(boolean)*: Optional configuration to turn off fetching metadata for tables. Default: `true`.
- **`includeViews`** *(boolean)*: Optional configuration to turn off fetching metadata for views. Default: `true`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `true`.
- **`includeStoredProcedures`** *(boolean)*: Optional configuration to toggle the Stored Procedures ingestion. Default: `true`.
- **`queryLogDuration`** *(integer)*: Configuration to tune how far we want to look back in query logs to process Stored Procedures results. Default: `1`.
- **`queryParsingTimeoutLimit`** *(integer)*: Configuration to set the timeout for parsing the query in seconds. Default: `300`.
- **`useFqnForFiltering`** *(boolean)*: Regex will be applied on fully qualified name (e.g service_name.db_name.schema_name.table_name) instead of raw name (e.g. table_name). Default: `false`.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
## Definitions

- <a id="definitions/databaseMetadataConfigType"></a>**`databaseMetadataConfigType`** *(string)*: Database Source Config Metadata Pipeline type. Must be one of: `["DatabaseMetadata"]`. Default: `"DatabaseMetadata"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
