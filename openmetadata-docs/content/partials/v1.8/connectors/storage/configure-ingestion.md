{% step srNumber=7 %}

{% stepDescription title="7. Configure Metadata Ingestion" %}

In this step we will configure the metadata ingestion pipeline,
Please follow the instructions below

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.8/connectors/configure-metadata-ingestion-storage.png"
alt="Configure Metadata Ingestion"
caption="Configure Metadata Ingestion Page" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

#### Metadata Ingestion Options

- **Name**: This field refers to the name of ingestion pipeline, you can customize the name or use the generated name.
- **Container Filter Pattern (Optional)**: To control whether to include a container as part of metadata ingestion.
    - **Include**: Explicitly include containers by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all containers with names matching one or more of the supplied regular expressions. All other containers will be excluded.
    - **Exclude**: Explicitly exclude containers by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all containers with names matching one or more of the supplied regular expressions. All other containers will be included.
- **Enable Debug Log (toggle)**: Set the Enable Debug Log toggle to set the default log level to debug.
- **Storage Metadata Config Source**: Here you can specify the location of your global manifest `openmetadata_storage_manifest.json` file. It can be located in S3, a local path or HTTP.

{% /extraContent %}
