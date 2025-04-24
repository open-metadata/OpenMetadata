{% step srNumber=7 %}

{% stepDescription title="7. Configure Metadata Ingestion" %}

In this step we will configure the metadata ingestion pipeline,
Please follow the instructions below

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.8/connectors/configure-metadata-ingestion-mlmodel.png"
alt="Configure Metadata Ingestion"
caption="Configure Metadata Ingestion Page" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

#### Metadata Ingestion Options

- **Name**: This field refers to the name of ingestion pipeline, you can customize the name or use the generated name.
- **Mark Deleted Ml Models (toggle):**: Set the Mark Deleted Ml Models toggle to flag ml models as soft-deleted if they are not present anymore in the source system.
- **ML Model Filter Pattern (Optional)**: To control whether to include an ML Model as part of metadata ingestion.
    - **Include**: Explicitly include ML Models by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all ML Models with names matching one or more of the supplied regular expressions. All other ML Models will be excluded.
    - **Exclude**: Explicitly exclude ML Models by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all ML Models with names matching one or more of the supplied regular expressions. All other ML Models will be included.
- **Enable Debug Log (toggle)**: Set the Enable Debug Log toggle to set the default log level to debug.

{% /extraContent %}
