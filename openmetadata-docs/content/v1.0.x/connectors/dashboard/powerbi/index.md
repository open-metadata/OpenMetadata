---
title: PowerBI
slug: /connectors/dashboard/powerbi
---

# PowerBI

| Stage      | PROD                         |
|------------|------------------------------|
| Dashboards | {% icon iconName="check" /%} |
| Charts     | {% icon iconName="check" /%} |
| Owners     | {% icon iconName="cross" /%} |
| Tags       | {% icon iconName="cross" /%} |
| Datamodels | {% icon iconName="cross" /%} |
| Lineage    | {% icon iconName="check" /%} |

In this section, we provide guides and references to use the PowerBI connector.

Configure and schedule PowerBI metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check
the following docs to connect using Airflow SDK or with the CLI.

{% tilesContainer %}

{% tile
    title="Ingest with Airflow"
    description="Configure the ingestion using Airflow SDK"
    link="/connectors/dashboard/powerbi/airflow"
  / %}
{% tile
    title="Ingest with the CLI"
    description="Run a one-time ingestion using the metadata CLI"
    link="/connectors/dashboard/powerbi/cli"
  / %}

{% /tilesContainer %}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To access the PowerBI APIs and import dashboards, charts, and datasets from PowerBI into OpenMetadata, a `PowerBI Pro` license is necessary.

### PowerBI Account Setup
### Step 1: Create an Azure AD app and configure the PowerBI Admin consle

Please follow the steps mentioned [here](https://docs.microsoft.com/en-us/power-bi/developer/embedded/embed-service-principal) for setting up the Azure AD application service principle and configure PowerBI admin settings

Login to [Power BI](https://app.powerbi.com/) as Admin and from `Tenant` settings allow below permissions.
- Allow service principles to use Power BI APIs
- Allow service principals to use read-only Power BI admin APIs
- Enhance admin APIs responses with detailed metadata

### Step 2: Provide necessary API permissions to the app
Go to the `Azure Ad app registrations` page, select your app and add the dashboard permissions to the app for PowerBI service and grant admin consent for the same:

The required permissions are:
- `Dashboard.Read.All`

Optional Permissions: (Without granting these permissions, the dataset information cannot be retrieved and the lineage processing will be skipped)
- `Dataset.Read.All`

{% note %}

Make sure that in the API permissions section **Tenant** related permissions are not being given to the app
Please refer [here](https://stackoverflow.com/questions/71001110/power-bi-rest-api-requests-not-authorizing-as-expected) for detailed explanation 

{% /note %}

### Step 3: Create New PowerBI workspace
The service principal only works with [new workspaces](https://docs.microsoft.com/en-us/power-bi/collaborate-share/service-create-the-new-workspaces).
[For reference](https://community.powerbi.com/t5/Service/Error-while-executing-Get-dataset-call-quot-API-is-not/m-p/912360#M85711)

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

Select PowerBI as the service type and click Next.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/powerbi/select-service.png"
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
  src="/images/v1.0/connectors/powerbi/add-new-service.png"
  alt="Add New Service"
  caption="Provide a Name and description for your Service" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=5 %}

{% stepDescription title="5. Configure the Service Connection" %}

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your powerbi service as
desired.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/powerbi/service-connection.png"
  alt="Configure service connection"
  caption="Configure the service connection by filling the form" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

**clientId**: PowerBI Client ID.

To get the client ID (also know as application ID), follow these steps:
- Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
- Search for App registrations and select the App registrations link.
- Select the Azure AD app you're using for embedding your Power BI content.
- From the Overview section, copy the Application (client) ID.

**clientSecret**: PowerBI Client Secret.

To get the client secret, follow these steps:
- Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
- Search for App registrations and select the App registrations link.
- Select the Azure AD app you're using for embedding your Power BI content.
- Under Manage, select Certificates & secrets.
- Under Client secrets, select New client secret.
- In the Add a client secret pop-up window, provide a description for your application secret, select when the application secret expires, and select Add.
- From the Client secrets section, copy the string in the Value column of the newly created application secret.

**tenantId**: PowerBI Tenant ID.

To get the tenant ID, follow these steps:
- Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
- Search for App registrations and select the App registrations link.
- Select the Azure AD app you're using for Power BI.
- From the Overview section, copy the Directory (tenant) ID.

**scope**: Service scope.

To let OM use the Power BI APIs using your Azure AD app, you'll need to add the following scopes:
- https://analysis.windows.net/powerbi/api/.default

Instructions for adding these scopes to your app can be found by following this link: https://analysis.windows.net/powerbi/api/.default.

**authorityUri**: Authority URI for the service.

To identify a token authority, you can provide a URL that points to the authority in question.

If you don't specify a URL for the token authority, we'll use the default value of https://login.microsoftonline.com/.

**hostPort**: URL to the PowerBI instance.

To connect with your Power BI instance, you'll need to provide the host URL. If you're using an on-premise installation of Power BI, this will be the domain name associated with your instance.

If you don't specify a host URL, we'll use the default value of https://app.powerbi.com to connect with your Power BI instance.

**Pagination Entity Per Page**:

The pagination limit for Power BI APIs can be set using this parameter. The limit determines the number of records to be displayed per page.

By default, the pagination limit is set to 100 records, which is also the maximum value allowed.

**Use Admin APIs**:

Option for using the PowerBI admin APIs:
- Enabled (Use PowerBI Admin APIs)
Using the admin APIs will fetch the dashboard and chart metadata from all the workspaces available in the PowerBI instance.

{% note %} 

When using the PowerBI Admin APIs there are no limitations on the Datasets that are retrieved for creating lineage information.

{% /note %}

- Disabled (Use Non-Admin PowerBI APIs)
Using the non-admin APIs will only fetch the dashboard and chart metadata from the workspaces that have the security group of the service principal assigned to them.

{% note %} 

When using the PowerBI Non-Admin APIs, the lineage information can only be generated if the dataset is a [Push Dataset](https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets).
For more information please visit the PowerBI official documentation [here](https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets/datasets-get-tables#limitations).

{% /note %}

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
