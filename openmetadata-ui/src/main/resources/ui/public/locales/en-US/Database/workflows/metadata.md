# Metadata

DatabaseService Metadata Pipeline Configuration.
## Properties

$$section
### Database Filter Pattern $(id="databaseFilterPattern")

Database filter patterns to control whether or not to include database as part of metadata ingestion. 

**Include**: Explicitly include databases by adding a list of comma-separated regular expressions to the `Include` field. OpenMetadata will include all databases with names matching one or more of the supplied regular expressions. All other databases will be excluded.

for example, to include only those databases for which the name starts with the word `demo`, add regex pattern in include field as `^demo.*`.

**Exclude**: Explicitly exclude databases by adding a list of comma-separated regular expressions to the `Exclude` field. OpenMetadata will exclude all databases with names matching one or more of the supplied regular expressions. All other databases will be included.

for example, to exclude all databases with the name containing the word `demo`, add regex pattern in exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for examples on database filter pattern
$$

$$section
### Schema Filter Pattern $(id="schemaFilterPattern")

Schema filter patterns are used to control whether or not to include schemas as part of metadata ingestion.

**Include**: Explicitly include schemas by adding a list of comma-separated regular expressions to the `Include` field. OpenMetadata will include all schemas with names matching one or more of the supplied regular expressions. All other schemas will be excluded.

for example, to include only those schemas for which the name starts with the word `demo`, add regex pattern in include field as `^demo.*`.

**Exclude**: Explicitly exclude schemas by adding a list of comma-separated regular expressions to the `Exclude` field. OpenMetadata will exclude all schemas with names matching one or more of the supplied regular expressions. All other schemas will be included.

for example, to exclude all schemas with the name containing the word `demo`, add regex pattern in exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for examples on schema filter pattern
$$

$$section
### Table Filter Pattern $(id="tableFilterPattern")

Table filter patterns are used to control whether or not to include tables as part of metadata ingestion.

**Include**: Explicitly include tables by adding a list of comma-separated regular expressions to the `Include` field. OpenMetadata will include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded.

for example, to include only those tables for which the name starts with the word `demo`, add regex pattern in include field as `^demo.*`.

**Exclude**: Explicitly exclude tables by adding a list of comma-separated regular expressions to the `Exclude` field. OpenMetadata will exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included.

for example, to exclude all tables with the name containing the word `demo`, add regex pattern in exclude field as `.*demo.*`.


Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#table-filter-pattern) document for examples on table filter pattern
$$

$$section
### Use FQN For Filtering $(id="useFqnForFiltering")

This flag set when you want to apply the filter on fully qualified name (e.g `service_name.db_name.schema_name.table_name`) instead of applying the filter to raw name of entity (e.g `table_name`). 

This Flag is useful in scenario when you have schema with same name in different databases, or table with same name in different schemas and you want to filter out one of them. 

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#table-filter-pattern) document for examples on how to use this field.

$$

$$section
### Include Views $(id="includeViews")

Set the `Include Views` toggle to control whether or not to include views as part of metadata ingestion.

$$

$$section
### Include Tags  $(id="includeTags")

Set the `Include Tags` toggle to control whether or not to include tags as part of metadata ingestion.

$$

$$section
### Enable Debug Logs $(id="loggerLevel")

Set the `Enable Debug Log` toggle to set the default log level to debug, these logs can be viewed later in Airflow.
$$

$$section
### Mark Deleted Tables $(id="markDeletedTables")

This is an optional configuration for enabling soft deletion of tables. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply solely to the schema that is currently being ingested via the pipeline. Any related entities such as test suites or lineage information that were associated with those tables will also be deleted.

Following are some examples of scenarios in which table will get soft deleted if this flag is enabled.

- If you have not applied any filter patterns for this ingestion pipeline then if any table was deleted from the data source, then the same table will be soft deleted from OpenMetadata as well.
- If you have applied a `Schema Filter Pattern` to include `SchemaA` then any table deleted from `SchemaA` will also be soft deleted from Openmetadata.
- If `TableA` was already ingested in OpenMetadata then later you apply a `Table Filter Pattern` to exclude `TableA` then `TableA` will get soft deleted from OpenMetadata.


Following are some examples of scenarios in which table will **NOT** get soft deleted if this flag is enabled.

- If you already have `SchemaA` & `SchemaB` ingested in OpenMetadata then later you apply a `Schema Filter Pattern` to exclude `SchemaB`, then no table from `SchemaB` will be deleted due to this ingestion pipeline.
- If you already have `SchemaA` & `SchemaB` ingested in OpenMetadata and for this ingestion pipeline you have applies a `Schema Filter Pattern` to include only `SchemaA` then any table deleted from `SchemaB` will not be deleted due to this ingestion pipeline.

$$

$$section
### Mark All Deleted Tables $(id="markAllDeletedTables")

This is an optional configuration for enabling soft deletion of tables. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply to all the schemas available in the data source. Any related entities such as test suites or lineage information that were associated with those tables will also be deleted. Do not enable this option when you have multiple metadata ingestion pipelines. Also make sure to enable the markDeletedTables option for this to work.

**It is recommended to be cautious while enabling this flag if you have multiple ingestion pipelines running for the same service, Because it is possible that a pipelines might delete the tables ingested by other pipeline.**

Following are some examples of scenarios in which table will get soft deleted if this flag is enabled.

- If you have not applied any filter patterns for this ingestion pipeline then if any table was deleted from the data source, then the same table will be soft deleted from OpenMetadata as well.
- If you have applied a Schema Filter Pattern to include `SchemaA` then any table deleted from `SchemaA` will also be soft deleted from Openmetadata.
- If `TableA` was already ingested in OpenMetadata then later you apply a `Table Filter Pattern` to exclude `TableA` then `TableA` will get soft deleted from OpenMetadata.
- If you already have `SchemaA` & `SchemaB` ingested in OpenMetadata then later you apply a `Schema Filter Pattern` to exclude `SchemaB`, then all table from `SchemaB` will be deleted due to this ingestion pipeline.

$$