---
title: Athena
slug: /connectors/database/athena
---

# Athena

<Table>

| Stage | Metadata |Query Usage | Data Profiler | Data Quality | Lineage | DBT | Supported Versions |
|:------:|:------:|:-----------:|:-------------:|:------------:|:-------:|:---:|:------------------:|
|  PROD  |   ✅   |      ❌      |       ✅       |       ✅      |    Partially via Views    |  ✅  |  --  |

</Table>

<Table>

| Lineage | Table-level | Column-level |
|:------:|:-----------:|:-------------:|
| Partially via Views | ✅ | ✅ |

</Table>

In this section, we provide guides and references to use the Athena connector.

Configure and schedule Athena metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [dbt Integration](#dbt-integration)

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check
the following docs to connect using Airflow SDK or with the CLI.

<TileContainer>
  <Tile
    icon="air"
    title="Ingest with Airflow"
    text="Configure the ingestion using Airflow SDK"
    link="/connectors/database/athena/airflow"
    size="half"
  />
  <Tile
    icon="account_tree"
    title="Ingest with the CLI"
    text="Run a one-time ingestion using the metadata CLI"
    link="/connectors/database/athena/cli"
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
src="/images/openmetadata/connectors/visit-services.png"
alt="Visit Services Page"
caption="Find Services under the Settings menu"
/>

### 2. Create a New Service

Click on the Add New Service button to start the Service creation.

<Image
src="/images/openmetadata/connectors/create-service.png"
alt="Create a new service"
caption="Add a new Service from the Services page"
/>

### 3. Select the Service Type

Select Athena as the service type and click Next.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/athena/select-service.png"
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
  src="/images/openmetadata/connectors/athena/add-new-service.png"
  alt="Add New Service"
  caption="Provide a Name and description for your Service"
/>
</div>


### 5. Configure the Service Connection

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your athena service as
desired.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/athena/service-connection.png"
  alt="Configure service connection"
  caption="Configure the service connection by filling the form"
/>
</div>


Once the credentials have been added, click on `Test Connection` and Save
the changes.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/test-connection.png"
  alt="Test Connection"
  caption="Test the connection and save the Service"
/>
</div>

#### Connection Options

- **AWS Access Key ID**: Enter your secure access key ID for your Athena connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.
- **AWS Secret Access Key**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
- **AWS Region**: Enter the location of the amazon cluster that your data and account are associated with.
- **AWS Session Token (optional)**: The AWS session token is an optional parameter. If you want, enter the details of your temporary session token.
- **Endpoint URL (optional)**: Your Athena connector will automatically determine the AWS Athena endpoint URL based on the region. You may override this behavior by entering a value to the endpoint URL.
- **Database (optional)**: The database of the data source is an optional parameter if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **S3 Staging Directory (optional)**: The S3 staging directory is an optional parameter. Enter a staging dirrectory to override the default staging directory for AWS Athena.
- **Athena Workgroup (optional)**: The Athena workgroup is an optional parameter. If you wish to have your Athena connection related to an existing AWS workgroup add your workgroup name here.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
  - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

### 6. Configure Metadata Ingestion

In this step we will configure the metadata ingestion pipeline,
Please follow the instructions below

<Image
src="/images/openmetadata/connectors/configure-metadata-ingestion-database.png"
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
- **Auto Tag PII(toggle)**: Auto PII tagging checks for column name to mark PII Sensitive/NonSensitive tag

### 7. Schedule the Ingestion and Deploy

Scheduling can be set up at an hourly, daily, or weekly cadence. The
timezone is in UTC. Select a Start Date to schedule for ingestion. It is
optional to add an End Date.

Review your configuration settings. If they match what you intended,
click Deploy to create the service and schedule metadata ingestion.

If something doesn't look right, click the Back button to return to the
appropriate step and change the settings as needed.

<Image
src="/images/openmetadata/connectors/schedule.png"
alt="Schedule the Workflow"
caption="Schedule the Ingestion Pipeline and Deploy"
/>

After configuring the workflow, you can click on Deploy to create the
pipeline.

### 8. View the Ingestion Pipeline

Once the workflow has been successfully deployed, you can view the
Ingestion Pipeline running from the Service Page.

<Image
src="/images/openmetadata/connectors/view-ingestion-pipeline.png"
alt="View Ingestion Pipeline"
caption="View the Ingestion Pipeline from the Service Page"
/>

### 9. Workflow Deployment Error

If there were any errors during the workflow deployment process, the
Ingestion Pipeline Entity will still be created, but no workflow will be
present in the Ingestion container.

You can then edit the Ingestion Pipeline and Deploy it again.

<Image
src="/images/openmetadata/connectors/workflow-deployment-error.png"
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
