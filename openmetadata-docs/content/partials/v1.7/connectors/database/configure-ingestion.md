{% step srNumber=7 %}

{% stepDescription title="7. Configure Metadata Ingestion" %}

In this step we will configure the metadata ingestion pipeline,
Please follow the instructions below

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.7/connectors/configure-metadata-ingestion-database-1.png"
  alt="Configure Metadata Ingestion"
  caption="Configure Metadata Ingestion Page - 1" /%}

{% image
  src="/images/v1.7/connectors/configure-metadata-ingestion-database-2.png"
  alt="Configure Metadata Ingestion"
  caption="Configure Metadata Ingestion Page - 2" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

#### Metadata Ingestion Options

{% note %}
If the owner's name is openmetadata, you need to enter `openmetadata@domain.com` in the name section of add team/user form, click [here](/connectors/ingestion/workflows/dbt/ingest-dbt-owner#following-steps-shows-adding-a-user-to-openmetadata) for more info.
{% /note %}

- **Name**: This field refers to the name of ingestion pipeline, you can customize the name or use the generated name.
- **Database Filter Pattern (Optional)**: Use to database filter patterns to control whether or not to include database as part of metadata ingestion.
    - **Include**: Explicitly include databases by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all databases with names matching one or more of the supplied regular expressions. All other databases will be excluded.
    - **Exclude**: Explicitly exclude databases by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all databases with names matching one or more of the supplied regular expressions. All other databases will be included.
- **Schema Filter Pattern (Optional)**: Use to schema filter patterns to control whether to include schemas as part of metadata ingestion.
    - **Include**: Explicitly include schemas by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all schemas with names matching one or more of the supplied regular expressions. All other schemas will be excluded.
    - **Exclude**: Explicitly exclude schemas by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all schemas with names matching one or more of the supplied regular expressions. All other schemas will be included.
- **Table Filter Pattern (Optional)**: Use to table filter patterns to control whether to include tables as part of metadata ingestion.
    - **Include**: Explicitly include tables by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded.
    - **Exclude**: Explicitly exclude tables by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included.
- **Enable Debug Log (toggle)**: Set the Enable Debug Log toggle to set the default log level to debug.
- **Mark Deleted Tables (toggle)**: Set the Mark Deleted Tables toggle to flag tables as soft-deleted if they are not present anymore in the source system.
- **Mark Deleted Tables from Filter Only (toggle)**: Set the Mark Deleted Tables from Filter Only toggle to flag tables as soft-deleted if they are not present anymore within the filtered schema or database only. This flag is useful when you have more than one ingestion pipelines. For example if you have a schema
- **includeTables (toggle)**: Optional configuration to turn off fetching metadata for tables.
- **includeViews (toggle)**: Set the Include views toggle to control whether to include views as part of metadata ingestion.
- **includeTags (toggle)**: Set the 'Include Tags' toggle to control whether to include tags as part of metadata ingestion.
- **includeOwners (toggle)**: Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten.
- **includeStoredProcedures (toggle)**: Optional configuration to toggle the Stored Procedures ingestion.
- **includeDDL (toggle)**: Optional configuration to toggle the DDL Statements ingestion.
- **queryLogDuration (Optional)**: Configuration to tune how far we want to look back in query logs to process Stored Procedures results.
- **queryParsingTimeoutLimit (Optional)**: Configuration to set the timeout for parsing the query in seconds.
- **useFqnForFiltering (toggle)**: Regex will be applied on fully qualified name (e.g service_name.db_name.schema_name.table_name) instead of raw name (e.g. table_name).

- **Incremental (Beta)**: Use Incremental Metadata Extraction after the first execution. This is done by getting the changed tables instead of all of them. **Only Available for BigQuery, Redshift and Snowflake**
    - **Enabled**: If `True`, enables Metadata Extraction to be Incremental.
    - **lookback Days**: Number of days to search back for a successful pipeline run. The timestamp of the last found successful pipeline run will be used as a base to search for updated entities.
    - **Safety Margin Days**: Number of days to add to the last successful pipeline run timestamp to search for updated entities.
- **Threads (Beta)**: Use a Multithread approach for Metadata Extraction. You can define here the number of threads you would like to run concurrently. For further information please check the documentation on [**Metadata Ingestion - Multithreading**](/connectors/ingestion/workflows/metadata/multithreading)

Note that the right-hand side panel in the OpenMetadata UI will also share useful documentation when configuring the ingestion.

{% /extraContent %}
