{% step srNumber=7 %}

{% stepDescription title="7. Configure Metadata Ingestion" %}

In this step we will configure the metadata ingestion pipeline,
Please follow the instructions below

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.8/connectors/configure-metadata-ingestion-messaging.png"
alt="Configure Metadata Ingestion"
caption="Configure Metadata Ingestion Page" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

#### Metadata Ingestion Options

- **Name**: This field refers to the name of ingestion pipeline, you can customize the name or use the generated name.
- **Topic Filter Pattern (Optional)**: Use it to control whether to include topics as part of metadata ingestion.
  - **Include**: Explicitly include topics by adding a list of comma-separated regular expressions to the 'Include' field. OpenMetadata will include all topics with names matching one or more of the supplied regular expressions. All other topics will be excluded.
  - **Exclude**: Explicitly exclude topics by adding a list of comma-separated regular expressions to the 'Exclude' field. OpenMetadata will exclude all topics with names matching one or more of the supplied regular expressions. All other topics will be included.
- **Ingest Sample Data (toggle)**: Set the 'Ingest Sample Data' toggle to ingest sample data from the topics.
- **Enable Debug Log (toggle)**: Set the 'Enable Debug Log' toggle to set the default log level to debug.
- **Mark Deleted Topics (toggle):** Set the 'Mark Deleted Topics' toggle to flag topics as soft-deleted if they are not present anymore in the source system.

{% /extraContent %}
