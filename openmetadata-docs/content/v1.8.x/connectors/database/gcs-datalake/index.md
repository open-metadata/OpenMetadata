---
title: GCS Datalake Connector | OpenMetadata Cloud Storage Integration
<<<<<<< HEAD
<<<<<<< HEAD
description: Connect GCS Datalake to OpenMetadata with our comprehensive connector guide. Step-by-step setup, configuration, and metadata extraction for Google Cloud Storage.
=======
description: Connect your Google Cloud Storage data lake to OpenMetadata with our comprehensive GCS connector guide. Setup instructions, configuration tips & best practices.
>>>>>>> bd5955fca2 (Docs: SEO Description Updation (#22035))
=======
description: Connect GCS Datalake to OpenMetadata with our comprehensive connector guide. Step-by-step setup, configuration, and metadata extraction for Google Cloud Storage.
>>>>>>> ac8f18500f (Doc: Meta Description Updation)
slug: /connectors/database/gcs-datalake
---

{% connectorDetailsHeader
name="GCS Datalake"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "Sample Data"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Owners", "dbt", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the GCS Datalake connector.

Configure and schedule GCS Datalake metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [Troubleshooting](/connectors/database/gcs-datalake/troubleshooting)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/gcs-datalake/yaml"} /%}

## Requirements

{% note %}
The GCS Datalake connector supports extracting metadata from file types `JSON`, `CSV`, `TSV` & `Parquet`.
{% /note %}

## Metadata Ingestion

{% partial 
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Datalake", 
    selectServicePath: "/images/v1.8/connectors/datalake/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/datalake/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/datalake/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details for GCS

- **Bucket Name**: A bucket name in DataLake is a unique identifier used to organize and store data objects.
  It's similar to a folder name, but it's used for object storage rather than file storage.

- **Prefix**: The prefix of a data source in datalake refers to the first part of the data path that identifies the source or origin of the data. It's used to organize and categorize data within the datalake, and can help users easily locate and access the data they need.

**GCS Credentials**

We support two ways of authenticating to GCS:

1. Passing the raw credential values provided by BigQuery. This requires us to provide the following information, all provided by BigQuery:
   1. Credentials type, e.g. `service_account`.
   2. Project ID
   3. Private Key ID
   4. Private Key
   5. Client Email
   6. Client ID
   7. Auth URI, [https://accounts.google.com/o/oauth2/auth](https://accounts.google.com/o/oauth2/auth) by default
   8. Token URI, **https://oauth2.googleapis.com/token** by default
   9. Authentication Provider X509 Certificate URL, [https://www.googleapis.com/oauth2/v1/certs](https://www.googleapis.com/oauth2/v1/certs) by default
   10. Client X509 Certificate URL

{% partial file="/v1.8/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.8/connectors/database/related.md" /%}
