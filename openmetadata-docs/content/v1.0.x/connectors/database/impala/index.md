---
title: Impala
slug: /connectors/database/impala
---

# Impala
{% multiTablesWrapper %}

| Stage              | BETA                |
|--------------------|---------------------|
| Metadata           | ✅                   |
| Query Usage        | ❌                   |
| Data Profiler      | ✅                   |
| Data Quality       | ✅                   |
| Lineage            | Partially via Views |
| DBT                | ❌                   |
| Supported Versions | Impala >= 2.0       |


{% /multiTablesWrapper %}

| Lineage | Table-level | Column-level |
|:------:|:-----------:|:-------------:|
| Partially via Views | ✅ | ✅ |



In this section, we provide guides and references to use the Impala connector.

Configure and schedule Impala metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check
the following docs to connect using Airflow SDK or with the CLI.


{% tilesContainer %}

{% tile
    title="Ingest with Airflow"
    description="Configure the ingestion using Airflow SDK"
    link="/connectors/database/impala/airflow"
  / %}
{% tile
    title="Ingest with the CLI"
    description="Run a one-time ingestion using the metadata CLI"
    link="/connectors/database/impala/cli"
  / %}

{% /tilesContainer %}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

## Metadata Ingestion

{% stepsContainer %}

{% step srNumber=1 %}

{% stepDescription title="1. Visit the Services Page" %}

The first step is ingesting the metadata from your sources. Under
Settings, you will find a Services link an external source system to
OpenMetadata. Once a service is created, it can be used to configure
metadata, usage, and profiler workflows.

To visit the Services page, select Services from the Settings menu.
{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/visit-database-service-page.png"
alt="Visit Services Page"
caption="Find Databases option on left panel of the settings page" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=2 %}

{% stepDescription title="2. Create a New Service" %}

Click on the Add New Service button to start the Service creation.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/create-database-service.png"
alt="Create a new service"
caption="Add a new Service from the Database Services page" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=3 %}

{% stepDescription title="3. Select the Service Type" %}

Select Impala as the service type and click Next.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/impala/select-service.png"
  alt="Select Service"
  caption="Select your service from the list" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=4 %}

{% stepDescription title="4. Name and Describe your Service" %}

Provide a name and description for your service as illustrated below.

#### Service Name

OpenMetadata uniquely identifies services by their Service Name. Provide
a name that distinguishes your deployment from other services, including
the other {connector} services that you might be ingesting metadata
from.


{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/impala/add-new-service.png"
  alt="Add New Service"
  caption="Provide a Name and description for your Service" /%}

{% /stepVisualInfo %}

{% /step %}


{% step srNumber=5 %}

{% stepDescription title="5. Configure the Service Connection" %}

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your impala service as
desired.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/impala/service-connection.png"
  alt="Configure service connection"
  caption="Configure the service connection by filling the form" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}
#### Connection Options

- **username**: Specify the User to connect to Impala. It should have enough privileges to read all the metadata.
- **password**: Password to connect to Impala.
- **hostPort**: Enter the fully qualified hostname and port number for your Impala deployment in the Host and Port field.
- **authMechanism**: This parameter specifies the authentication method to use when connecting to the Impala server. Possible values are `NOSASL`, `PLAIN`, `GSSAPI`, `LDAP`, `JWT`. If you are using Kerberos authentication, you should set auth to `GSSAPI`. 
- **kerberosServiceName**: This parameter specifies the Kerberos service name to use for authentication. This should only be specified if using Kerberos authentication.
- **databaseSchema**: Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **databaseName**: In OpenMetadata, the Database Service hierarchy works as follows:
`Database Service > Database > Schema > Table`. In the case of Impala, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
- **useSSL**: Establish secure connection with Impala. Enables SSL for the connector.
- **authOptions**: Enter the auth options string for impala connection.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Impala during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Impala during the connection. These details must be added as Key-Value pairs. 
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /extraContent %}

{% step srNumber=6 %}

{% stepDescription title="6. Test the Connection" %}

Once the credentials have been added, click on `Test Connection` and Save
the changes.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/test-connection.png"
  alt="Test Connection"
  caption="Test the connection and save the Service" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=7 %}

{% stepDescription title="7. Configure Metadata Ingestion" %}

In this step we will configure the metadata ingestion pipeline,
Please follow the instructions below

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/configure-metadata-ingestion-database.png"
alt="Configure Metadata Ingestion"
caption="Configure Metadata Ingestion Page" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

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
- **Mark Deleted Tables (toggle)**: This is an optional configuration for enabling soft deletion of tables. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply solely to the schema that is currently being ingested via the pipeline. Any related entities such as test suites or lineage information that were associated with those tables will also be deleted..
- **Auto Tag PII(toggle)**: Auto PII tagging checks for column name to mark PII Sensitive/NonSensitive tag

{% /extraContent %}

{% step srNumber=8 %}

{% stepDescription title="8. Schedule the Ingestion and Deploy" %}

Scheduling can be set up at an hourly, daily, weekly, or manual cadence. The
timezone is in UTC. Select a Start Date to schedule for ingestion. It is
optional to add an End Date.

Review your configuration settings. If they match what you intended,
click Deploy to create the service and schedule metadata ingestion.

If something doesn't look right, click the Back button to return to the
appropriate step and change the settings as needed.

After configuring the workflow, you can click on Deploy to create the
pipeline.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/schedule.png"
alt="Schedule the Workflow"
caption="Schedule the Ingestion Pipeline and Deploy" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=9 %}

{% stepDescription title="9. View the Ingestion Pipeline" %}

Once the workflow has been successfully deployed, you can view the
Ingestion Pipeline running from the Service Page.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/view-ingestion-pipeline.png"
alt="View Ingestion Pipeline"
caption="View the Ingestion Pipeline from the Service Page" /%}

{% /stepVisualInfo %}

{% /step %}

{% /stepsContainer %}
## Troubleshooting

 ### Workflow Deployment Error

If there were any errors during the workflow deployment process, the
Ingestion Pipeline Entity will still be created, but no workflow will be
present in the Ingestion container.

- You can then edit the Ingestion Pipeline and Deploy it again.

- From the Connection tab, you can also Edit the Service if needed.

{% image
src="/images/v1.0/connectors/workflow-deployment-error.png"
alt="Workflow Deployment Error"
caption="Edit and Deploy the Ingestion Pipeline" /%}

## Related

{% tilesContainer %}

{% tile
  title="Profiler Workflow"
  description="Learn more about how to configure the Data Profiler from the UI."
  link="/connectors/ingestion/workflows/profiler" /%}

{% tile
  title="Data Quality Workflow"
  description="Learn more about how to configure the Data Quality tests from the UI."
  link="/connectors/ingestion/workflows/data-quality" /%}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}