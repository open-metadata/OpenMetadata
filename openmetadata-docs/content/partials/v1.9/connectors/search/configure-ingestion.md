{% step srNumber=7 %}

{% stepDescription title="7. Configure Metadata Ingestion" %}

In this step we will configure the metadata ingestion pipeline,
Please follow the instructions below

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.9/connectors/configure-metadata-ingestion-search.png"
alt="Configure Metadata Ingestion"
caption="Configure Metadata Ingestion Page" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

#### Metadata Ingestion Options

- **Name**: This field refers to the name of ingestion pipeline, you can customize the name or use the generated name.
- **Search Index Filter Pattern (Optional)**: Use to search index filter patterns to control whether or not to include search index as part of metadata ingestion.
    - **Include**: Explicitly include search index by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all search indexes with names matching one or more of the supplied regular expressions. All other schemas will be excluded.
    - **Exclude**: Explicitly exclude search index by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all search indexes with names matching one or more of the supplied regular expressions. All other schemas will be included.
- **Include Sample Data (toggle)**: Set the Ingest Sample Data toggle to control whether to ingest sample data as part of metadata ingestion.
- **Sample Size**: If include sample data is enabled, 10 records will be ingested by default. Using this field you can customize the size of sample data.
- **Include Index Templates (toggle)**: Set the Include Index Templates toggle to control whether to include index templates as part of metadata ingestion.
- **Override Metadata**: Set the Override Metadata toggle to control whether to override the metadata if it already exists.
- **Enable Debug Log (toggle)**: Set the Enable Debug Log toggle to set the default log level to debug.


{% /extraContent %}
