---
title: Superset
slug: /connectors/dashboard/superset
---

# Superset

| Stage      | PROD                         |
|------------|------------------------------|
| Dashboards | {% icon iconName="check" /%} |
| Charts     | {% icon iconName="check" /%} |
| Owners     | {% icon iconName="check" /%} |
| Tags       | {% icon iconName="cross" /%} |
| Datamodels | {% icon iconName="cross" /%} |
| Lineage    | {% icon iconName="check" /%} |

In this section, we provide guides and references to use the Superset connector.

Configure and schedule Superset metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check
the following docs to connect using Airflow SDK or with the CLI.

{% tilesContainer %}

{% tile
    title="Ingest with Airflow"
    description="Configure the ingestion using Airflow SDK"
    link="/connectors/dashboard/superset/airflow"
  / %}
{% tile
    title="Ingest with the CLI"
    description="Run a one-time ingestion using the metadata CLI"
    link="/connectors/dashboard/superset/cli"
  / %}

{% /tilesContainer %}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

The ingestion also works with Superset 2.0.0 🎉

**Note:**

**API Connection**: To extract metadata from Superset via API, user must have at least `can read on Chart` & `can read on Dashboard` permissions.

**Database Connection**: To extract metadata from Superset via MySQL or Postgres database, database user must have at least `SELECT` priviledge on `dashboards` & `slices` tables within superset schema.

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
src="/images/v1.0/connectors/visit-services.png"
alt="Visit Services Page"
caption="Find Dashboard option on left panel of the settings page" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=2 %}

{% stepDescription title="2. Create a New Service" %}

Click on the 'Add New Service' button to start the Service creation.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/create-service.png"
alt="Create a new service"
caption="Add a new Service from the Dashboard Services page" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=3 %}

{% stepDescription title="3. Select the Service Type" %}

Select Superset as the service type and click Next.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/superset/select-service.png"
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
  src="/images/v1.0/connectors/superset/add-new-service.png"
  alt="Add New Service"
  caption="Provide a Name and description for your Service" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=5 %}

{% stepDescription title="5. Configure the Service Connection" %}

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your superset service as
desired.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/superset/service-connection.png"
  alt="Configure service connection"
  caption="Configure the service connection by filling the form" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

- **Host and Port**: The `Host and Post` parameter is common for all three modes of authentication which specifies the host and port of the Superset instance. This should be specified as a string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set the hostPort parameter to `https://org.superset.com:8088`.

- **Superset Connection**: Add the connection details to fetch metadata from Superset either through APIs or Database.

##### For Superset API Connection

Superset API connection is the default mode of authentication where we fetch the metadata using [Superset APIs](https://superset.apache.org/docs/api/). 

**Note**:
Superset only supports basic or ldap authentication through APIs so if you have SSO enabled on your Superset instance then this mode of authentication will not work for you and you can opt for MySQL or Postgres Connection to fetch metadata directly from the database in the backend of Superset.

- **Username**: Username to connect to Superset, for ex. `user@organization.com`. This user should have access to relevant dashboards and charts in Superset to fetch the metadata.
- **Password**: Password of the user account to connect with Superset.
- **Provider**: Choose between `db`(default) or `ldap` mode of Authentication provider for the Superset service. This parameter is used internally to connect to Superset's REST API.

#### For MySQL Connection

You can use Mysql Connection when you have SSO enabled and your Superset is backed by Mysql database.

- **Username**: Specify the User to connect to MySQL. It should have enough privileges to read all the metadata. Make sure the user has select privileges on `dashboards`, `tables` & `slices` tables of superset schema.
- **Password**: Password to connect to MySQL.
- **Host and Port**: Enter the fully qualified hostname and port number for your MySQL deployment in the Host and Port field.
- **databaseSchema**: Enter the database schema which is associated with the Superset instance..
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`


#### For Postgres Connection

You can use Postgres Connection when you have SSO enabled and your Superset is backed by Postgres database.

- **Username**: Specify the User to connect to Postgres. Make sure the user has select privileges on `dashboards`, `tables` & `slices` tables of superset schema.
- **Password**: Password to connect to Postgres.
- **Host and Port**: Enter the fully qualified hostname and port number for your Postgres deployment in the Host and Port field.
- **Database**: Initial Postgres database to connect to. Specify the name of database associated with Superset instance.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Postgres during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Postgres during the connection. These details must be added as Key-Value pairs. 
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
src="/images/v1.0/connectors/configure-metadata-ingestion-dashboard.png"
alt="Configure Metadata Ingestion"
caption="Configure Metadata Ingestion Page" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

#### Metadata Ingestion Options

- **Name**: This field refers to the name of ingestion pipeline, you can customize the name or use the generated name.
- **Dashboard Filter Pattern (Optional)**: Use it to control whether to include dashboard as part of metadata ingestion.
    - **Include**: Explicitly include dashboards by adding a list of comma-separated regular expressions to the 'Include' field. OpenMetadata will include all dashboards with names matching one or more of the supplied regular expressions. All other dashboards will be excluded.
    - **Exclude**: Explicitly exclude dashboards by adding a list of comma-separated regular expressions to the 'Exclude' field. OpenMetadata will exclude all dashboards with names matching one or more of the supplied regular expressions. All other dashboards will be included.
- **Chart Pattern (Optional)**: Use it to control whether to include charts as part of metadata ingestion.
    - **Include**: Explicitly include charts by adding a list of comma-separated regular expressions to the 'Include' field. OpenMetadata will include all charts with names matching one or more of the supplied regular expressions. All other charts will be excluded.
    - **Exclude**: Explicitly exclude charts by adding a list of comma-separated regular expressions to the 'Exclude' field. OpenMetadata will exclude all charts with names matching one or more of the supplied regular expressions. All other charts will be included.
- **Data Model Pattern (Optional)**: Use it to control whether to include data modes as part of metadata ingestion.
    - **Include**: Explicitly include data models by adding a list of comma-separated regular expressions to the 'Include' field. OpenMetadata will include all data models with names matching one or more of the supplied regular expressions. All other data models will be excluded.
    - **Exclude**: Explicitly exclude data models by adding a list of comma-separated regular expressions to the 'Exclude' field. OpenMetadata will exclude all data models with names matching one or more of the supplied regular expressions. All other data models will be included.
- **Database Service Name (Optional)**: Enter the name of Database Service which is already ingested in OpenMetadata to create lineage between dashboards and database tables.
- **Enable Debug Log (toggle)**: Set the 'Enable Debug Log' toggle to set the default log level to debug, these logs can be viewed later in Airflow.
- **Include Owners (toggle)**: Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten.
- **Include Tags (toggle)**: Set the 'Include Tags' toggle to control whether to include tags in metadata ingestion.
- **Include Data Models (toggle)**: Set the 'Include Data Models' toggle to control whether to include tags as part of metadata ingestion.
- **Mark Deleted Dashboards (toggle)**: Set the 'Mark Deleted Dashboards' toggle to flag dashboards as soft-deleted if they are not present anymore in the source system.

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
