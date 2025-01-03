---
title: databaseServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseservicemetadatapipeline
---

# DatabaseServiceMetadataPipeline

*DatabaseService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/databaseMetadataConfigType*. Default: `DatabaseMetadata`.
- **`markDeletedTables`** *(boolean)*: This is an optional configuration for enabling soft deletion of tables. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply solely to the schema that is currently being ingested via the pipeline. Any related entities such as test suites or lineage information that were associated with those tables will also be deleted. Default: `True`.
- **`markDeletedStoredProcedures`** *(boolean)*: Optional configuration to soft delete stored procedures in OpenMetadata if the source stored procedures are deleted. Also, if the stored procedures is deleted, all the associated entities like lineage, etc., with that stored procedures will be deleted. Default: `True`.
- **`includeTables`** *(boolean)*: Optional configuration to turn off fetching metadata for tables. Default: `True`.
- **`includeViews`** *(boolean)*: Optional configuration to turn off fetching metadata for views. Default: `True`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `True`.
- **`includeOwners`** *(boolean)*: Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten. Default: `False`.
- **`includeStoredProcedures`** *(boolean)*: Optional configuration to toggle the Stored Procedures ingestion. Default: `True`.
- **`includeDDL`** *(boolean)*: Optional configuration to toggle the DDL Statements ingestion. Default: `True`.
- **`queryLogDuration`** *(integer)*: Configuration to tune how far we want to look back in query logs to process Stored Procedures results. Default: `1`.
- **`queryParsingTimeoutLimit`** *(integer)*: Configuration to set the timeout for parsing the query in seconds. Default: `300`.
- **`useFqnForFiltering`** *(boolean)*: Regex will be applied on fully qualified name (e.g service_name.db_name.schema_name.table_name) instead of raw name (e.g. table_name). Default: `False`.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.

## Definitions

- **`databaseMetadataConfigType`** *(string)*: Database Source Config Metadata Pipeline type. Must be one of: `['DatabaseMetadata']`. Default: `DatabaseMetadata`.

## Incremental

- Use Incremental Metadata Extraction after the first execution. This is done by getting the changed tables instead of all of them. **Only Available for BigQuery, Redshift and Snowflake**
- **`Enabled`**: Optional configuration for Metadata Extraction to be Incremental. Default: `True`,
- **`lookback Days`**: Number of days to search back for a successful pipeline run. The timestamp of the last found successful pipeline run will be used as a base to search for updated entities. Default: `7`
- **`Safety Margin Days`**: Number of days to add to the last successful pipeline run timestamp to search for updated entities. Default: `1`

Documentation file automatically generated at 2023-10-27 13:55:46.343512.
