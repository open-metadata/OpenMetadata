---
title: SSIS
slug: /connectors/pipeline/ssis
collate: true
---

{% connectorDetailsHeader
name="SSIS"
stage="BETA"
platform="Collate"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage"]
unavailableFeatures=["Tags", "owners"]
/ %}

In this section, we provide guides and references to use the SSIS connector.

Configure and schedule SSIS metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
    - [Connection Details](#connection-details)
- [Troubleshooting](/connectors/pipeline/ssis/troubleshooting)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/ssis/yaml"} /%}

## Requirements
To extract SSIS metadata, we need the batabase connection details where the metadata is stored.

- `API` Permission ( While Creating the User, from Admin -> User )
- To retrieve lineage data, the user must be granted [Component-level permissions](https://docs.matillion.com/metl/docs/2932106/#component).

## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "SSIS", 
    selectServicePath: "/images/v1.9/connectors/ssis/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/ssis/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/ssis/service-connection.png",
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

To fetch task dependencies and lineage information from your SSIS pipelines, the connector requires access to the SSIS package XML files. You have two options to provide these files:

- **Local Path**: Specify the local directory path where your SSIS package files are stored. The connector will read the XML files directly from this location during metadata extraction.
> **Important:**  
> If you are using the **Local Path** option to provide your SSIS package files, you must run the ingestion workflow through the **CLI** instead of the UI. This is because the ingestion process needs direct access to your local filesystem, which is not available when running ingestion jobs from the UI or server.  


- **S3 Bucket**: Upload your SSIS project folders containing the package XML files to an S3 bucket. Then, provide the S3 credentials (such as `awsAccessKeyId`, `awsSecretAccessKey`, and region) along with the bucket name in the connector configuration. The connector will retrieve the package files from your S3 storage.

Choose the method that best fits your environment to ensure the connector can access the necessary package XML files for comprehensive metadata and lineage extraction.

- **Note <s3>:**  
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

- **Note <localPath>:**
> When configuring the SSIS connector to extract metadata from a **local path**, you need to provide the path up to the directory containing your SSIS project folders.  
> 
> For example, if your projects are organized as:
> ```
> /home/user/repos/
>   project1/
>     project1/
>       ... .dtsx files
>   project2/
>     project2/
>       ... .dtsx files
> ```
> 
> You should specify the path up to `/home/user/repos/` in your connector configuration. The connector will recursively scan this directory to locate all SSIS project folders and their package XML files.
> 
> Ensure that the user running the ingestion workflow has read permissions for the specified local path and all its subdirectories.



- **S3 Storage Service**: To connect to the bucket having xml files:
  - Provide the s3 credentials including awsAccessKeyId and awsSecretAccessKey
  - Provide the appropriate AWS region (e.g., `us-east-2`) for your S3 bucket.
  - Specify the endpoint URL for your S3-compatible storage.
  - It is necessary to provide the bucket name containing the SSIS project folders.


{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
