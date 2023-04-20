# Metadata

DatabaseService Metadata Pipeline Configuration.
## Properties

$$section

### Database Filter Pattern $(id="databaseFilterPattern")

Database filter patterns to control whether or not to include database as part of metadata ingestion. Enter the regex pattern form the for including or excluding the database. Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for examples on database filter pattern
$$

$$section
### Schema Filter Pattern $(id="schemaFilterPattern")

Schema filter patterns are used to control whether or not to include schemas as part of metadata ingestion.Enter the regex pattern form the for including or excluding the database schema. Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for examples on schema filter pattern
$$

$$section
### Table Filter Pattern $(id="tableFilterPattern")

Table filter patterns are used to control whether or not to include tables as part of metadata ingestion.Enter the regex pattern form the for including or excluding the tables. Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#table-filter-pattern) document for examples on table filter pattern
$$

$$section
### Use FQN For Filtering $(id="useFqnForFiltering")

This flag set when you want to apply the filter on fully qualified name (e.g service_name.db_name.schema_name.table_name) instead of applying the filter to raw name of entity (e.g table_name). This Flag is useful in scenario when you have schema with same name in different databases or table with same name in different schemas and you want to filter out one of them. This will be exaplined further in detail in this document. Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#table-filter-pattern) document for examples on how to use this field.

$$

$$section
### Include Views $(id="includeViews")

Set the Include views toggle to control whether or not to include views as part of metadata ingestion.

$$

$$section
### Include Tags  $(id="includeTags")

Set the Include tags toggle to control whether or not to include tags as part of metadata ingestion.

$$

$$section
### Enable Debug Logs $(id="loggerLevel")

Enabling debug logs tracks error messages during ingestion for troubleshooting.
$$

$$section
### Mark Deleted Tables $(id="markDeletedTables")

This is an optional configuration for enabling soft deletion of tables. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply solely to the schema that is currently being ingested via the pipeline. Any related entities such as test suites or lineage information that were associated with those tables will also be deleted.
$$

$$section
### Mark All Deleted Tables $(id="markAllDeletedTables")

This is an optional configuration for enabling soft deletion of tables. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply to all the schemas available in the data source. Any related entities such as test suites or lineage information that were associated with those tables will also be deleted. Do not enable this option when you have multiple metadata ingestion pipelines. Also make sure to enable the markDeletedTables option for this to work.
$$