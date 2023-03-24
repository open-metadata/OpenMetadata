---
title: Airflow
slug: /connectors/pipeline/airflow
---

# Airflow

In this section, we provide guides and references to use the Airflow connector.

Configure and schedule Airflow metadata workflow from the OpenMetadata UI:

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check the following docs to
extract metadata directly from your Airflow instance or via the CLI:

<TileContainer>
<Tile
  icon="air"
  title="Ingest directly from your Airflow"
  text="Configure the ingestion with a DAG on your own Airflow instance"
  link={
    "/connectors/pipeline/airflow/gcs"
  }
  size="half"
/>
<Tile
  icon="account_tree"
  title="Ingest with the CLI"
  text="Run a one-time ingestion using the metadata CLI"
  link={
    "/connectors/pipeline/airflow/cli"
  }
  size="half"
/>
</TileContainer>


## Requirements

<InlineCallout color="violet-70" icon="description" bold="OpenMetadata 0.12 or later" href="/deployment">
To deploy OpenMetadata, check the <a href="/deployment">Deployment</a> guides.
</InlineCallout>

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

<Note>

Note that we only support officially supported Airflow versions. You can check the version list [here](https://airflow.apache.org/docs/apache-airflow/stable/installation/supported-versions.html).

</Note>

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

Select Airflow as the service type and click Next.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/airflow/select-service.png"
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
  src="/images/openmetadata/connectors/airflow/add-new-service.png"
  alt="Add New Service"
  caption="Provide a Name and description for your Service"
/>
</div>


### 5. Configure the Service Connection

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your airflow service as
desired.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/airflow/service-connection.png"
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

- **Host and Port**: URL to the Airflow instance.
- **Number of Status**: Number of status we want to look back to in every ingestion (e.g., Past executions from a DAG).
- **Connection**: Airflow metadata database connection. See these [docs](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html)
  for supported backends.

In terms of `connection` we support the following selections:

- `backend`: Should not be used from the UI. This is only applicable when ingesting Airflow metadata locally
    by running the ingestion from a DAG. It will use the current Airflow SQLAlchemy connection to extract the data.
- `MySQL`, `Postgres`, `MSSQL` and `SQLite`: Pass the required credentials to reach out each of these services. We
    will create a connection to the pointed database and read Airflow data from there.

### 6. Configure Metadata Ingestion

In this step we will configure the metadata ingestion pipeline,
Please follow the instructions below

<Image
src="/images/openmetadata/connectors/configure-metadata-ingestion-pipeline.png"
alt="Configure Metadata Ingestion"
caption="Configure Metadata Ingestion Page"
/>

#### Metadata Ingestion Options

- **Name**: This field refers to the name of ingestion pipeline, you can customize the name or use the generated name.
- **Pipeline Filter Pattern (Optional)**: Use to pipeline filter patterns to control whether or not to include pipeline as part of metadata ingestion.
    - **Include**: Explicitly include pipeline by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all pipeline with names matching one or more of the supplied regular expressions. All other schemas will be excluded.
    - **Exclude**: Explicitly exclude pipeline by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all pipeline with names matching one or more of the supplied regular expressions. All other schemas will be included.
- **Include lineage (toggle)**: Set the Include lineage toggle to control whether or not to include lineage between pipelines and data sources as part of metadata ingestion.
- **Enable Debug Log (toggle)**: Set the Enable Debug Log toggle to set the default log level to debug, these logs can be viewed later in Airflow.

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
