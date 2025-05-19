---
title: SSIS
slug: /connectors/pipeline/ssis
---

{% connectorDetailsHeader
name="SSIS"
stage="BETA"
platform="Collate"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage", "Owners"]
unavailableFeatures=["Tags"]
/ %}

In this section, we provide guides and references to use the SSIS connector.

Configure and schedule SSIS metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
    - [Connection Details](#connection-details)
- [Troubleshooting](/connectors/pipeline/ssis/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/ssis/yaml"} /%}

## Requirements
To extract SSIS metadata, we need the batabase connection details where the metadata is stored.

- `API` Permission ( While Creating the User, from Admin -> User )
- To retrieve lineage data, the user must be granted [Component-level permissions](https://docs.matillion.com/metl/docs/2932106/#component).
- To enable lineage tracking in Matillion, **Matillion Enterprise Mode** is required. For detailed setup instructions and further information, refer to the official documentation: [Matillion Lineage Documentation](https://docs.matillion.com/metl/docs/2881895/).

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "SSIS", 
    selectServicePath: "/images/v1.7/connectors/ssis/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/ssis/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/ssis/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Connection**: SSIS metadata database connection.

In terms of `connection` we support the following selections:

- **Microsoft SQL Server**: To connect to the SSIS metadata database:
  - Provide the SQL Server connection credentials including username and password
  - Specify the database name where SSIS metadata is stored
  - Enter the host and port for the SQL Server instance
  - The connector will establish a connection to this database to extract SSIS pipeline metadata

> **Note:**  
> When configuring the SSIS connector to extract metadata from S3 storage, you need to upload your SSIS project folders containing all your package files to your S3 bucket.  
> 
> Typically, SSIS organizes projects in a structure like:
> ```
> repos/
>   project1/
>     project1/
>       ... .dtsx files
>   project2/
>     project2/
>       ... .dtsx files
> ```
> 
> You should upload the inner project folders (e.g., `project1/project1/`, `project2/project2/`, etc.) into your S3 bucket. For example, if your bucket name is `packages`, the structure in your bucket should look like:
> ```
> packages/
>   project1/
>     project1/
>       ... .dtsx files
>   project2/
>     project2/
>       ... .dtsx files
> ```
> 
> It is necessary to provide the same bucket name (e.g., `packages`) along with the credentials for your S3 storage when configuring the connector.


- **S3 Storage Service**: To connect to the bucket having xml files:
  - Provide the s3 credentials including awsAccessKeyId and awsSecretAccessKey
  - Provide the appropriate AWS region (e.g., `us-east-2`) for your S3 bucket.
  - Specify the endpoint URL for your S3-compatible storage.
  - It is necessary to provide the bucket name containing the SSIS project folders.


{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
