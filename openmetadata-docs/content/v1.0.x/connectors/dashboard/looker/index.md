---
title: Looker
slug: /connectors/dashboard/looker
---

# Looker

| Stage      | PROD                         |
|------------|------------------------------|
| Dashboards | {% icon iconName="check" /%} |
| Charts     | {% icon iconName="check" /%} |
| Owners     | {% icon iconName="check" /%} |
| Tags       | {% icon iconName="cross" /%} |
| Datamodels | {% icon iconName="check" /%} |
| Lineage    | {% icon iconName="check" /%} |

In this section, we provide guides and references to use the Looker connector.

Configure and schedule Looker metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check
the following docs to connect using Airflow SDK or with the CLI.

{% tilesContainer %}

{% tile
    title="Ingest with Airflow"
    description="Configure the ingestion using Airflow SDK"
    link="/connectors/dashboard/looker/airflow"
  / %}
{% tile
    title="Ingest with the CLI"
    description="Run a one-time ingestion using the metadata CLI"
    link="/connectors/dashboard/looker/cli"
  / %}

{% /tilesContainer %}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with 
custom Airflow plugins to handle the workflow deployment.

There are two types of metadata we ingest from Looker:
- Dashboards & Charts
- LookML Models

In terms of permissions, we need a user with access to the Dashboards and LookML Explores that we want to ingest. You can
create your API credentials following these [docs](https://cloud.google.com/looker/docs/api-auth).

However, LookML Views are not present in the Looker SDK. Instead, we need to extract that information directly from
the GitHub repository holding the source `.lkml` files. In order to get this metadata, we will require a GitHub token
with read only access to the repository. You can follow these steps from the GitHub [documentation](https://docs.github.com/en/enterprise-server@3.4/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token).

{% note %}

The GitHub credentials are completely optional. Just note that without them, we won't be able to ingest metadata
out of LookML Views, including their lineage to the source databases.

{% /note %}

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

Select Looker as the service type and click Next.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/looker/select-service.png"
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
  src="/images/v1.0/connectors/looker/add-new-service.png"
  alt="Add New Service"
  caption="Provide a Name and description for your Service" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=5 %}

{% stepDescription title="5. Configure the Service Connection" %}

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your looker service as
desired.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/looker/service-connection.png"
  alt="Configure service connection"
  caption="Configure the service connection by filling the form" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: URL to the Looker instance, e.g., `https://my-company.region.looker.com`.
- **Client ID**: User's Client ID to authenticate to the SDK. This user should have privileges to read all the metadata in Looker.
- **Client Secret**: User's Client Secret for the same ID provided.

Then, if we choose to inform the GitHub credentials to ingest LookML Views:

- **Repository Owner**: The owner (user or organization) of a GitHub repository. For example, in https://github.com/open-metadata/OpenMetadata, the owner is `open-metadata`.
- **Repository Name**: The name of a GitHub repository. For example, in https://github.com/open-metadata/OpenMetadata, the name is `OpenMetadata`.
- **API Token**: Token to use the API. This is required for private repositories and to ensure we don't hit API limits.

Follow these [steps](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token) in order to create a fine-grained personal access token.

When configuring, give repository access to `Only select repositories` and choose the one containing your LookML files. Then, we only need `Repository Permissions` as `Read-only` for `Contents`.


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

Scheduling can be set up at an hourly, daily, or weekly cadence. The
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

