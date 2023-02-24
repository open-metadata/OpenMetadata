---
title: Presto
slug: /connectors/database/presto
---

# Presto
<Table>

| Stage | Metadata |Query Usage | Data Profiler | Data Quality | Lineage | DBT | Supported Versions |
|:------:|:------:|:-----------:|:-------------:|:------------:|:-------:|:---:|:------------------:|
|  PROD  |   ✅   |       ❌      |       ✅       |       ✅      |    Partially via Views    |  ✅  |  --  |

</Table>

<Table>

| Lineage | Table-level | Column-level |
|:------:|:-----------:|:-------------:|
| Partially via Views | ✅ | ✅ |

</Table>

In this section, we provide guides and references to use the Presto connector.

Configure and schedule Presto metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check
the following docs to connect using Airflow SDK or with the CLI.

<TileContainer>
  <Tile
    icon="air"
    title="Ingest with Airflow"
    text="Configure the ingestion using Airflow SDK"
    link="/connectors/database/presto/airflow"
    size="half"
  />
  <Tile
    icon="account_tree"
    title="Ingest with the CLI"
    text="Run a one-time ingestion using the metadata CLI"
    link="/connectors/database/presto/cli"
    size="half"
  />
</TileContainer>

## Requirements

<InlineCallout color="violet-70" icon="description" bold="OpenMetadata 0.12 or later" href="/deployment">
To deploy OpenMetadata, check the <a href="/deployment">Deployment</a> guides.
</InlineCallout>

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

## Metadata Ingestion

### 1. Visit the Services Page

The first step is ingesting the metadata from your sources. Under
Settings, you will find a Services link an external source system to
OpenMetadata. Once a service is created, it can be used to configure
metadata, usage, and profiler workflows.

To visit the Services page, select Services from the Settings menu.

<Image
src="/images/openmetadata/connectors/visit-services.webp"
alt="Visit Services Page"
caption="Find Services under the Settings menu"
/>

### 2. Create a New Service

Click on the Add New Service button to start the Service creation.

<Image
src="/images/openmetadata/connectors/create-service.webp"
alt="Create a new service"
caption="Add a new Service from the Services page"
/>

### 3. Select the Service Type

Select Presto as the service type and click Next.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/presto/select-service.webp"
  alt="Select Service"
  caption="Select your service from the list"
/>
</div>

### 4. Name and Describe your Service

Provide a name and description for your service as illustrated below.

#### Service Name

OpenMetadata uniquely identifies services by their Service Name. Provide
a name that distinguishes your deployment from other services, including
the other {connector} services that you might be ingesting metadata
from.


<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/presto/add-new-service.webp"
  alt="Add New Service"
  caption="Provide a Name and description for your Service"
/>
</div>


### 5. Configure the Service Connection

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your presto service as
desired.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/presto/service-connection.webp"
  alt="Configure service connection"
  caption="Configure the service connection by filling the form"
/>
</div>


Once the credentials have been added, click on `Test Connection` and Save
the changes.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/test-connection.webp"
  alt="Test Connection"
  caption="Test the connection and save the Service"
/>
</div>

#### Connection Options

- **Username**: Specify the User to connect to Presto. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Presto.
- **Host and Port**: Enter the fully qualified hostname and port number for your Presto deployment in the Host and Port field.
- **Catalog**: Presto offers a catalog feature where all the databases are stored. (Providing the Catalog is not mandatory from 0.12.2 or greater versions)
- **DatabaseSchema**: DatabaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Presto during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Presto during the connection. These details must be added as Key-Value pairs. 
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
  - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

### 6. Configure Metadata Ingestion

In this step we will configure the metadata ingestion pipeline,
Please follow the instructions below

<Image
src="/images/openmetadata/connectors/configure-metadata-ingestion-database.webp"
alt="Configure Metadata Ingestion"
caption="Configure Metadata Ingestion Page"
/>

#### Metadata Ingestion Options

- **Name**: This field refers to the name of ingestion pipeline, you can customize the name or use the generated name.
- **Database Filter Pattern (Optional)**: Use to database filter patterns to control whether or not to include database as part of metadata ingestion.
  - **Include**: Explicitly include databases by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all databases with names matching one or more of the supplied regular expressions. All other databases will be excluded.
  - **Exclude**: Explicitly exclude databases by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all databases with names matching one or more of the supplied regular expressions. All other databases will be included.
- **Schema Filter Pattern (Optional)**: Use to schema filter patterns to control whether or not to include schemas as part of metadata ingestion.
  - **Include**: Explicitly include schemas by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all schemas with names matching one or more of the supplied regular expressions. All other schemas will be excluded.
  - **Exclude**: Explicitly exclude schemas by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all schemas with names matching one or more of the supplied regular expressions. All other schemas will be included.
- **Table Filter Pattern (Optional)**: Use to table filter patterns to control whether or not to include tables as part of metadata ingestion.
  - **Include**: Explicitly include tables by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded.
  - **Exclude**: Explicitly exclude tables by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included.
- **Include views (toggle)**: Set the Include views toggle to control whether or not to include views as part of metadata ingestion.
- **Include tags (toggle)**: Set the Include tags toggle to control whether or not to include tags as part of metadata ingestion.
- **Enable Debug Log (toggle)**: Set the Enable Debug Log toggle to set the default log level to debug, these logs can be viewed later in Airflow.
- **Mark Deleted Tables (toggle)**: Set the Mark Deleted Tables toggle to flag tables as soft-deleted if they are not present anymore in the source system.
- **Mark Deleted Tables from Filter Only (toggle)**: Set the Mark Deleted Tables from Filter Only toggle to flag tables as soft-deleted if they are not present anymore within the filtered schema or database only. This flag is useful when you have more than one ingestion pipelines. For example if you have a schema

### 7. Schedule the Ingestion and Deploy

Scheduling can be set up at an hourly, daily, or weekly cadence. The
timezone is in UTC. Select a Start Date to schedule for ingestion. It is
optional to add an End Date.

Review your configuration settings. If they match what you intended,
click Deploy to create the service and schedule metadata ingestion.

If something doesn't look right, click the Back button to return to the
appropriate step and change the settings as needed.

<Image
src="/images/openmetadata/connectors/schedule.webp"
alt="Schedule the Workflow"
caption="Schedule the Ingestion Pipeline and Deploy"
/>

After configuring the workflow, you can click on Deploy to create the
pipeline.

### 8. View the Ingestion Pipeline

Once the workflow has been successfully deployed, you can view the
Ingestion Pipeline running from the Service Page.

<Image
src="/images/openmetadata/connectors/view-ingestion-pipeline.webp"
alt="View Ingestion Pipeline"
caption="View the Ingestion Pipeline from the Service Page"
/>

### 9. Workflow Deployment Error

If there were any errors during the workflow deployment process, the
Ingestion Pipeline Entity will still be created, but no workflow will be
present in the Ingestion container.

You can then edit the Ingestion Pipeline and Deploy it again.

<Image
src="/images/openmetadata/connectors/workflow-deployment-error.webp"
alt="Workflow Deployment Error"
caption="Edit and Deploy the Ingestion Pipeline"
/>

From the Connection tab, you can also Edit the Service if needed.

## Data Profiler

<Tile
icon="schema"
title="Profiler Workflow"
text="Learn more about how to configure the Data Profiler from the UI."
link="/connectors/ingestion/workflows/profiler"
/>

## Data Quality

<Tile
icon="air"
title="Data Quality Workflow"
text="Learn more about how to configure the Data Quality tests from the UI."
link="/connectors/ingestion/workflows/data-quality"
/>

## dbt Integration

<Tile
icon="mediation"
title="dbt Integration"
text="Learn more about how to ingest dbt models' definitions and their lineage."
link="/connectors/ingestion/workflows/dbt"
/>

