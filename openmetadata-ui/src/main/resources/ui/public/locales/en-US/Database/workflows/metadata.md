# Metadata

DatabaseService Metadata Pipeline Configuration.
## Properties

### Mark Deleted Tables $(id="markDeletedTables")

This is an optional configuration for enabling soft deletion of tables. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply solely to the schema that is currently being ingested via the pipeline. Any related entities such as test suites or lineage information that were associated with those tables will also be deleted.

### Mark All Deleted Tables $(id="markAllDeletedTables")

This is an optional configuration for enabling soft deletion of tables. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply to all the schemas available in the data source. Any related entities such as test suites or lineage information that were associated with those tables will also be deleted. Do not enable this option when you have multiple metadata ingestion pipelines. Also make sure to enable the markDeletedTables option for this to work.

### Schema Filter Pattern $(id="schemaFilterPattern")

Regex to only fetch tables or databases that matches the pattern.

### Table Filter Pattern $(id="tableFilterPattern")

 Regex exclude tables or databases that matches the pattern.

 ### Database Filter Pattern $(id="databaseFilterPattern")

Regex to only fetch databases that matches the pattern.

