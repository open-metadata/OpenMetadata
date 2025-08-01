---
title: databaseServiceMetadataPipeline | Official Documentation
description: Connect Databaseservicemetadatapipeline to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseservicemetadatapipeline
---

# DatabaseServiceMetadataPipeline

*DatabaseService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/databaseMetadataConfigType](#definitions/databaseMetadataConfigType)*. Default: `"DatabaseMetadata"`.
- **`markDeletedTables`** *(boolean)*: This is an optional configuration for enabling soft deletion of tables. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply solely to the schema that is currently being ingested via the pipeline. Any related entities such as test suites or lineage information that were associated with those tables will also be deleted. Default: `true`.
- **`markDeletedStoredProcedures`** *(boolean)*: Optional configuration to soft delete stored procedures in OpenMetadata if the source stored procedures are deleted. Also, if the stored procedures is deleted, all the associated entities like lineage, etc., with that stored procedures will be deleted. Default: `true`.
- **`includeTables`** *(boolean)*: Optional configuration to turn off fetching metadata for tables. Default: `true`.
- **`includeViews`** *(boolean)*: Optional configuration to turn off fetching metadata for views. Default: `true`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `true`.
- **`includeOwners`** *(boolean)*: Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten. Default: `false`.
- **`includeStoredProcedures`** *(boolean)*: Optional configuration to toggle the Stored Procedures ingestion. Default: `true`.
- **`includeDDL`** *(boolean)*: Optional configuration to toggle the DDL Statements ingestion. Default: `false`.
- **`overrideMetadata`** *(boolean)*: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. Default: `false`.
- **`queryLogDuration`** *(integer)*: Configuration to tune how far we want to look back in query logs to process Stored Procedures results. Default: `1`.
- **`queryParsingTimeoutLimit`** *(integer)*: Configuration to set the timeout for parsing the query in seconds. Default: `300`.
- **`useFqnForFiltering`** *(boolean)*: Regex will be applied on fully qualified name (e.g service_name.db_name.schema_name.table_name) instead of raw name (e.g. table_name). Default: `false`.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`threads`** *(integer)*: Number of Threads to use in order to parallelize Table ingestion. Default: `1`.
- **`incremental`**: Use incremental Metadata extraction after the first execution. This is commonly done by getting the changes from Audit tables on the supporting databases. Refer to *[#/definitions/incremental](#definitions/incremental)*.
## Definitions

- **`databaseMetadataConfigType`** *(string)*: Database Source Config Metadata Pipeline type. Must be one of: `["DatabaseMetadata"]`. Default: `"DatabaseMetadata"`.
- **`incremental`** *(object)*: Use incremental Metadata extraction after the first execution. This is commonly done by getting the changes from Audit tables on the supporting databases. Cannot contain additional properties.
  - **`enabled`** *(boolean, required)*: If True, enables Metadata Extraction to be incremental. Default: `false`.
  - **`lookbackDays`** *(integer)*: Number os days to search back for a successful pipeline run. The timestamp of the last found successful pipeline run will be used as a base to search for updated entities. Default: `7`.
  - **`safetyMarginDays`** *(integer)*: Number of days to add to the last successful pipeline run timestamp to search for updated entities. Default: `1`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
