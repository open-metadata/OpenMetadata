---
description: >-
  In this section, we provide the guides and reference to use the Superset
  connector.
---

# Superset

Configure and schedule Superset **metadata** workflows from the OpenMetadata UI.

* [Requirements](./#requirements)
* [Metadata Ingestion](./#metadata-ingestion)

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check the following docs to connect using Airflow SDK or with the CLI.

{% content-ref url="run-metabase-connector-with-the-airflow-sdk.md" %}
[run-metabase-connector-with-the-airflow-sdk.md](run-metabase-connector-with-the-airflow-sdk.md)
{% endcontent-ref %}

{% content-ref url="run-metabase-connector-with-the-cli.md" %}
[run-metabase-connector-with-the-cli.md](run-metabase-connector-with-the-cli.md)
{% endcontent-ref %}

## **Requirements**

#### **OpenMetadata (version 0.10 or later)**

To deploy OpenMetadata, follow the procedure [Try OpenMetadata in Docker](../../../overview/run-openmetadata.md).

To run the Ingestion via the UI you'll need to use the OpenMetadata [Ingestion Container](https://hub.docker.com/r/openmetadata/ingestion), which comes shipped with custom Airflow plugins to handle the workflow deployment.

## Metadata Ingestion

### 1. Visit the _Services_ Page

The first step is ingesting the metadata from your sources. Under Settings, you will find a **Services** link an external source system to OpenMetadata. Once a service is created, it can be used to configure metadata, usage, and profiler workflows.

To visit the _Services_ page, select _Services_ from the _Settings_ menu.

![Navigate to Settings >> Services](<../../../docs/.gitbook/assets/image (4) (1).png>)

### 2. Create a New Service

Click on the _Add New Service_ button to start the Service creation.

![Add a New Service from the Services Page](<../../../docs/.gitbook/assets/image (20).png>)

### 3. Select the Service Type

Select Superset as the service type and click _Next_.

![](<../../../.gitbook/assets/image (104).png>)

### 4. Name and Describe your Service

Provide a name and description for your service as illustrated below.

#### Service Name

OpenMetadata uniquely identifies services by their _Service Name_. Provide a name that distinguishes your deployment from other services, including the other Superset services that you might be ingesting metadata from.

![](<../../../.gitbook/assets/image (54) (1) (1).png>)

### 5. Configure the Service Connection

In this step, we will configure the connection settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Superset service as desired.

![](<../../../.gitbook/assets/image (136).png>)

<details>

<summary>Connection Options</summary>

**Username**

Enter the username of your Superset user in the _Username_ field. The specified user should be authorized to read all databases you want to include in the metadata ingestion workflow.

**Password**

Enter the password for your Superset user in the _Password_ field.

**Host and Port**

Enter the fully qualified hostname and port number for your Superset deployment in the _Host and Port_ field.

**Database Service Name (optional)**

Enter the Database Service Name for the Lineage creation.

</details>

![](<../../../.gitbook/assets/image (5) (1).png>)

### 6. Configure the Metadata Ingestion

Once the service is created, we can add a **Metadata Ingestion Workflow**, either directly from the _Add Ingestion_ button in the figure above, or from the Service page:

![](<../../../.gitbook/assets/image (30) (1).png>)

<details>

<summary>Metadata Ingestion Options</summary>

**Include (Dashboard Filter Pattern)**

Use to dashboard filter patterns to control whether or not to include dashboards as part of metadata ingestion.

Explicitly include dashboards by adding a list of comma-separated regular expressions to the _Include_ field. OpenMetadata will include all dashboards with names matching one or more of the supplied regular expressions. All other dashboards will be excluded.

**Exclude (Dashboard Filter Pattern)**

Explicitly exclude dashboards by adding a list of comma-separated regular expressions to the _Exclude_ field. OpenMetadata will exclude all dashboards with names matching one or more of the supplied regular expressions. All other dashboards will be included.

**Include (Chart Filter Pattern)**

Use to chart filter patterns to control whether or not to include charts as part of metadata ingestion and data profiling.

Explicitly include charts by adding a list of comma-separated regular expressions to the _Include_ field. OpenMetadata will include all charts with names matching one or more of the supplied regular expressions. All other charts will be excluded.

**Exclude (Chart Filter Pattern)**

Explicitly exclude charts by adding a list of comma-separated regular expressions to the _Exclude_ field. OpenMetadata will exclude all charts with names matching one or more of the supplied regular expressions. All other charts will be included.

</details>

### 7. Schedule the Ingestion and Deploy

Scheduling can be set up at an hourly, daily, or weekly cadence. The timezone is in UTC. Select a Start Date to schedule for ingestion. It is optional to add an End Date.

Review your configuration settings. If they match what you intended, click _Deploy_ to create the service and schedule metadata ingestion.

If something doesn't look right, click the _Back_ button to return to the appropriate step and change the settings as needed.

![](<../../../.gitbook/assets/image (83).png>)

<details>

<summary><strong>Scheduling Options</strong></summary>

**Every**

Use the _Every_ drop down menu to select the interval at which you want to ingest metadata. Your options are as follows:

* _Hour_: Ingest metadata once per hour
* _Day_: Ingest metadata once per day
* _Week_: Ingest metadata once per week

**Minute**

The _Minute_ dropdown is only active when ingesting metadata once per hour. Use the _Minute_ drop down menu to select the minute of the hour at which to begin ingesting metadata.

</details>

After configuring the workflow, you can click on _Deploy_ to create the pipeline.

### 8. View the Ingestion Pipeline

Once the workflow has been successfully deployed, you can view the Ingestion Pipeline running from the Service Page.

![](<../../../.gitbook/assets/image (36) (1).png>)

### 9. Workflow Deployment Error

If there were any errors during the workflow deployment process, the Ingestion Pipeline Entity will still be created, but no workflow will be present in the Ingestion container.

You can then edit the Ingestion Pipeline and _Deploy_ it again.

![](<../../../.gitbook/assets/image (18).png>)

From the _Connection_ tab, you can also _Edit_ the Service if needed.

## Run using Airflow SDK

You can learn more about how to host and run the different workflows on your own Airflow instances below:

{% content-ref url="run-metabase-connector-with-the-airflow-sdk.md" %}
[run-metabase-connector-with-the-airflow-sdk.md](run-metabase-connector-with-the-airflow-sdk.md)
{% endcontent-ref %}

## One-time ingestion with the CLI

You can learn more about how to run a one-time ingestion of the different workflows using the `metadata` CLI below:

{% content-ref url="run-metabase-connector-with-the-cli.md" %}
[run-metabase-connector-with-the-cli.md](run-metabase-connector-with-the-cli.md)
{% endcontent-ref %}
