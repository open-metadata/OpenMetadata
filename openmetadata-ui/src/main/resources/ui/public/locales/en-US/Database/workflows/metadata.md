# Metadata

Database Service Metadata Pipeline Configuration.

## Configuration

$$section
### Database Filter Pattern $(id="databaseFilterPattern")

Database filter patterns to control whether to include databases as part of metadata ingestion. 

**Include**: Explicitly include databases by adding a list of regular expressions to the `Include` field. OpenMetadata will include all databases with names matching one or more of the supplied regular expressions. All other databases will be excluded.

For example, to include only those databases whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude databases by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all databases with names matching one or more of the supplied regular expressions. All other databases will be included.

For example, to exclude all databases with the name containing the word `demo`, add the regex pattern in the exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for further examples on database filter patterns.
$$

$$section
### Schema Filter Pattern $(id="schemaFilterPattern")

Schema filter patterns are used to control whether to include schemas as part of metadata ingestion.

**Include**: Explicitly include schemas by adding a list of regular expressions to the `Include` field. OpenMetadata will include all schemas with names matching one or more of the supplied regular expressions. All other schemas will be excluded.

For example, to include only those schemas whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude schemas by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all schemas with names matching one or more of the supplied regular expressions. All other schemas will be included.

For example, to exclude all schemas with the name containing the word `demo`, add regex pattern in the exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for further examples on schema filter patterns.
$$

$$section
### Table Filter Pattern $(id="tableFilterPattern")

Table filter patterns are used to control whether to include tables as part of metadata ingestion.

**Include**: Explicitly include tables by adding a list of regular expressions to the `Include` field. OpenMetadata will include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded.

For example, to include only those tables whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude tables by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included.

For example, to exclude all tables with the name containing the word `demo`, add the regex pattern in the exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#table-filter-pattern) document for further examples on table filter patterns.
$$

$$section
### Use FQN For Filtering $(id="useFqnForFiltering")

Set this flag when you want to apply the filters on Fully Qualified Names (e.g `service_name.db_name.schema_name.table_name`) instead of applying them to the raw name of the asset (e.g `table_name`). 

This Flag is useful in scenarios when you have different schemas with same name in multiple databases, or tables with same name in different schemas, and you want to filter out only one of them. 

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#table-filter-pattern) document for further examples on how to use this field.

$$

$$section
### Include Views $(id="includeViews")

Set the `Include Views` toggle to control whether to include views as part of metadata ingestion.

$$

$$section
### Include Tags  $(id="includeTags")

Set the `Include Tags` toggle to control whether to include tags as part of metadata ingestion.

$$

$$section
### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the logging level of the process to debug. You can check these logs in the Ingestion tab of the service and dig deeper into any errors you might find.
$$

$$section
### Mark Deleted Tables $(id="markDeletedTables")

This is an optional configuration for enabling **soft deletion** of tables during the ingestion. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply ONLY to the schema that is currently being ingested via the pipeline. 

Any related entities such as test suites or lineage information that were associated with those tables will also be deleted.

Here are some examples of scenarios in which tables will get soft deleted if this flag is enabled.

- If no filters were applied, but a table was deleted from the data source, then the same table will be soft deleted from OpenMetadata as well.
- If you have applied a `Schema Filter Pattern` to include `SchemaA` then any table deleted from `SchemaA` will also be soft deleted from Openmetadata.
- If `TableA` was already ingested in OpenMetadata, then later you apply a `Table Filter Pattern` to exclude `TableA` then `TableA` will get soft deleted from OpenMetadata.

Here are some examples of scenarios where tables will **NOT** get soft deleted if this flag is enabled.

- If you already have `SchemaA` & `SchemaB` ingested in OpenMetadata, then later you apply a `Schema Filter Pattern` to exclude `SchemaB`, then no table from `SchemaB` will be deleted.
- If you already have `SchemaA` & `SchemaB` ingested in OpenMetadata and for this ingestion pipeline you have applied a `Schema Filter Pattern` to include only `SchemaA`, then any table deleted from `SchemaB` will not be deleted (since it is ignored in the ingestion).

In such cases you may delete the table/schema manually from UI.

$$

$$section
### Mark Deleted Stored Procedures $(id="markDeletedStoredProcedures")
This is an optional configuration for enabling **soft deletion** of stored procedures during the ingestion. When this option is enabled, only stored procedures that have been deleted from the source will be soft deleted, and this will apply ONLY to the schema that is currently being ingested via the pipeline. 

Any related entities such as test suites or lineage information that were associated with those stored procedures will also be deleted.

Here are some examples of scenarios in which stored procedures will get soft deleted if this flag is enabled.

- If no filters were applied, but a stored procedure was deleted from the data source, then the same stored procedure will be soft deleted from OpenMetadata as well.
- If you have applied a `Schema Filter Pattern` to include `SchemaA` then any stored procedure deleted from `SchemaA` will also be soft deleted from Openmetadata.
- If `StoredProcedureA` was already ingested in OpenMetadata, then later you apply a `StoredProcedure Filter Pattern` to exclude `StoredProcedureA` then `StoredProcedureA` will get soft deleted from OpenMetadata.

Here are some examples of scenarios where stored procedures will **NOT** get soft deleted if this flag is enabled.

- If you already have `SchemaA` & `SchemaB` ingested in OpenMetadata, then later you apply a `Schema Filter Pattern` to exclude `SchemaB`, then no stored procedure from `SchemaB` will be deleted.
- If you already have `SchemaA` & `SchemaB` ingested in OpenMetadata and for this ingestion pipeline you have applied a `Schema Filter Pattern` to include only `SchemaA`, then any stored procedure deleted from `SchemaB` will not be deleted (since it is ignored in the ingestion).

In such cases you may delete the stored procedure/schema manually from UI.

$$

$$section
### View Definition Parsing Timeout Limit $(id="viewParsingTimeoutLimit")

Specify the timeout limit for parsing the view definition sql queries to perform the lineage analysis.
$$

$$section
### Number of Retries $(id="retries")

Times to retry the workflow in case it ends with a failure.
$$