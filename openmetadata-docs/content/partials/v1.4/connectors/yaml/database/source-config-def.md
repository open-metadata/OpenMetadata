#### Source Configuration - Source Config

{% codeInfo srNumber=100 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json):

**markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.

**includeTables**: true or false, to ingest table data. Default is true.

**includeViews**: true or false, to ingest views definitions.

**databaseFilterPattern**, **schemaFilterPattern**, **tableFilterPattern**: Note that the filter supports regex as include or exclude. You can find examples [here](/connectors/ingestion/workflows/metadata/filter-patterns/database)

**threads (beta)**: The number of threads to use when extracting the metadata using multithreading. Please take a look [here](/connectors/ingestion/workflows/metadata/multithreading) before configuring this.

**incremental (beta)**: Incremental Extraction configuration. Currently implemented for:

- [BigQuery](/connectors/ingestion/workflows/metadata/incremental-extraction/bigquery)
- [Redshift](/connectors/ingestion/workflows/metadata/incremental-extraction/redshift)
- [Snowflake](/connectors/ingestion/workflows/metadata/incremental-extraction/snowflake)

{% /codeInfo %}
