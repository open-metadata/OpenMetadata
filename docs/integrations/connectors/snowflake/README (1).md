---
description: >-
  In this section, we provide guides and references to use the Snowflake
  connector.
---

# Postgres

Configure and schedule Snowflake **metadata** and **profiler** workflows from the OpenMetadata UI.

* [Requirements](<README (1).md#requirements>)
* [Metadata Ingestion](<README (1).md#metadata-ingestion>)
* [Data Profiler and Quality Tests](<README (1).md#data-profiler-and-quality-tests>)
* [DBT Integration](<README (1).md#dbt-integration>)

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check the following docs to connect using Airflow SDK or with the CLI.

{% content-ref url="run-postgres-connector-with-the-airflow-sdk.md" %}
[run-postgres-connector-with-the-airflow-sdk.md](run-postgres-connector-with-the-airflow-sdk.md)
{% endcontent-ref %}

{% content-ref url="run-postgres-connector-with-the-cli.md" %}
[run-postgres-connector-with-the-cli.md](run-postgres-connector-with-the-cli.md)
{% endcontent-ref %}

## Requirements

#### **OpenMetadata (version 0.10 or later)**

To deploy OpenMetadata, follow the procedure [Try OpenMetadata in Docker](../../../overview/run-openmetadata/).

To run the Ingestion via the UI you'll need to use the OpenMetadata [Ingestion Container](https://hub.docker.com/r/openmetadata/ingestion), which comes shipped with custom Airflow plugins to handle the workflow deployment.

## Metadata Ingestion

### 1. Visit the _Services_ Page

The first step is ingesting the metadata from your sources. Under Settings you will find a **Services** link an external source system to OpenMetadata. Once a service is created, it can be used to configure metadata, usage, and profiler workflows.

To visit the _Services_ page, select _Services_ from the _Settings_ menu.&#x20;

![Find Services under the Settings Menu](<../../../.gitbook/assets/image (5) (1) (1).png>)

### 2. Create a New Service

Click on the _Add New Service_ button to start the Service creation.

![Add a New Service from the Services Page](<../../../.gitbook/assets/image (44) (2).png>)

### 3. Select the Service Type

Select Snowflake as the service type and click _Next_.

![](<../../../.gitbook/assets/Screenshot 2022-04-28 at 2.53.00 PM.png>)

### 4. Name and Describe your Service

Provide a name and description for your service as illustrated below.

#### Service Name

OpenMetadata uniquely identifies services by their _Service Name_. Provide a name that distinguishes your deployment from other services, including the other Snowflake services that you might be ingesting metadata from.

#### Description

Provide a description for your Snowflake service that enables other users to determine whether it might provide data of interest to them.

![Provide a Name and a description for your Service](<../../../.gitbook/assets/image (6) (1).png>)

### 5. Configure the Service Connection

In this step, we will configure the connection settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Snowflake service as desired.

![](<../../../.gitbook/assets/Screenshot 2022-04-28 at 3.01.26 PM.png>)

#### Username

Enter the username of your `Postgres` user in the _Username_ field. The specified user should be authorized to read all databases you want to include in the metadata ingestion workflow.

#### Password

Enter the password for your Postgres user in the _Password_ field.

#### Host and Port

Enter the fully qualified hostname and port number for your Postgres deployment in the _Host and Port_ field.

#### Connection Options (Optional)

Enter the details for any additional connection options that can be sent to Postgres during the connection. These details must be added as Key-Value pairs.

#### Connection Arguments (Optional)

Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Postgres during the connection. These details must be added as Key-Value pairs.

![](<../../../.gitbook/assets/Screenshot 2022-04-28 at 3.17.01 PM.png>)

### 6. Configure the Metadata Ingestion

Once the service is created, we can add a **Metadata Ingestion Workflow**, either directly from the _Add Ingestion_ button in the figure above, or from the Service page:

![](<../../../.gitbook/assets/Screenshot 2022-04-28 at 6.05.10 PM.png>)

#### Include (Table Filter Pattern)

Use to table filter patterns to control whether or not to include tables as part of metadata ingestion and data profiling.

Explicitly include tables by adding a list of comma-separated regular expressions to the _Include_ field. OpenMetadata will include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded. See the figure above for an example.

#### Exclude (Table Filter Pattern)

Explicitly exclude tables by adding a list of comma-separated regular expressions to the _Exclude_ field. OpenMetadata will exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included. See the figure above for an example.

#### Include (Schema Filter Pattern)

Use to schema filter patterns to control whether or not to include schemas as part of metadata ingestion and data profiling.

Explicitly include schemas by adding a list of comma-separated regular expressions to the _Include_ field. OpenMetadata will include all schemas with names matching one or more of the supplied regular expressions. All other schemas will be excluded.

#### Exclude (Schema Filter Pattern)

Explicitly exclude schemas by adding a list of comma-separated regular expressions to the _Exclude_ field. OpenMetadata will exclude all schemas with names matching one or more of the supplied regular expressions. All other schemas will be included.

**Include views (toggle)**

Set the _Include views_ toggle to the on position to control whether or not to include views as part of metadata ingestion and data profiling.

Explicitly include views by adding the following key-value pair in the `source.config` field of your configuration file.

**Enable data profiler (toggle)**

The data profiler ingests usage information for tables. This enables you to assess the frequency of use, reliability, and other details.

When enabled, the data profiler will run as part of metadata ingestion. Running the data profiler increases the amount of time it takes for metadata ingestion but provides the benefits mentioned above.

Set the _Enable data profiler_ toggle to the on position to enable the data profiler.

**Ingest sample data (toggle)**

Set the _Ingest sample data_ toggle to the on position to control whether or not to generate sample data to include in table views in the OpenMetadata user interface.

### 7. Schedule the Ingestion and Deploy

Scheduling can be set up at an hourly, daily, or weekly cadence. The timezone is in UTC. Select a Start Date to schedule for ingestion. It is optional to add an End Date.

Review your configuration settings. If they match what you intended, click _Deploy_ to create the service and schedule metadata ingestion.

If something doesn't look right, click the _Back_ button to return to the appropriate step and change the settings as needed.

![Schedule the Ingestion Pipeline and Deploy](<../../../.gitbook/assets/image (21) (1).png>)

**Every**

Use the _Every_ drop down menu to select the interval at which you want to ingest metadata. Your options are as follows:

* _Hour_: Ingest metadata once per hour
* _Day_: Ingest metadata once per day
* _Week_: Ingest metadata once per week

**Day**

The _Day_ selector is only active when ingesting metadata once per week. Use the _Day_ selector to set the day of the week on which to ingest metadata.

**Minute**

The _Minute_ dropdown is only active when ingesting metadata once per hour. Use the _Minute_ drop down menu to select the minute of the hour at which to begin ingesting metadata.

**Time**

The _Time_ drop down menus are active when ingesting metadata either once per day or once per week. Use the time drop downs to select the time of day at which to begin ingesting metadata.

**Start date (UTC)**

Use the _Start date_ selector to choose the date at which to begin ingesting metadata according to the defined schedule.

**End date (UTC)**

Use the _End date_ selector to choose the date at which to stop ingesting metadata according to the defined schedule. If no end date is set, metadata ingestion will continue according to the defined schedule indefinitely.

After configuring the workflow, you can click on _Deploy_ to create the pipeline.

### 8. View the Ingestion Pipeline

Once the workflow has been successfully deployed, you can view the Ingestion Pipeline running from the Service Page.

![](<../../../.gitbook/assets/Screenshot 2022-04-28 at 3.20.27 PM.png>)

### 9. Workflow Deployment Error

If there were any errors during the workflow deployment process, the Ingestion Pipeline Entity will still be created, but no workflow will be present in the Ingestion container.

You can then edit the Ingestion Pipeline and _Deploy_ it again.

![](<../../../.gitbook/assets/image (8).png>)

## Data Profiler and Quality Tests

After the metadata ingestion has been done correctly, we can configure and deploy the Profiler Workflow.

This Pipeline will be in charge of feeding the Profiler tab of the Table Entity, as well as running any tests configured in the Entity.

![](<../../../.gitbook/assets/Screenshot 2022-04-28 at 6.23.55 PM (1).png>)

![](<../../../.gitbook/assets/Screenshot 2022-04-28 at 6.23.34 PM.png>)

You can learn how to configure the Data Quality of a Table Entity [here](../../../../data-quality/data-quality-overview/).

### 1. Add a Profiler Ingestion

From the Service Page, go to the _Ingestions_ tab to add a new ingestion and click on _Add Profiler Ingestion_.

![](<../../../.gitbook/assets/Screenshot 2022-04-28 at 6.27.57 PM.png>)

If you already added a Usage ingestion, the button will directly specify to _Add Profiler Ingestion_.

### 2. Configure the Profiler Ingestion

Here you can enter the Profiler Ingestion details.

![](<../../../.gitbook/assets/Screenshot 2022-04-28 at 6.34.36 PM.png>)

#### Name

Define the name of the Profiler Workflow. While we only support a single workflow for the Metadata and Usage ingestion, users can define different schedules and filters for Profiler workflows.

As profiling is a costly task, this enables a fine-grained approach to profiling and running tests by specifying different filters for each pipeline.

#### FQN Filter Pattern

Regex patterns to be applied to the Tables' Fully Qualified Names. Note that Tables' FQNs are built as `serviceName.DatabaseName.SchemaName.TableName`, with a dot `.` as the FQN separator.

#### Description

Give the Ingestion Pipeline a description to show what type of data we are profiling.

### 3. Schedule and Deploy

After clicking _Next_, you will be redirected to the Scheduling form. This will be the same as the Metadata and Usage Ingestions. Select your desired schedule and click on Deploy to find the usage pipeline being added to the Service Ingestions.

## DBT Integration

You can learn more about how to ingest DBT models' definitions and their lineage [here](../../../data-lineage/dbt-integration.md).

## Run using Airflow SDK

You can learn more about how to host and run the different workflows on your own Airflow instances [here](run-postgres-connector-with-the-airflow-sdk.md).

## One-time ingestion with the CLI

You can learn more about how to run a one-time ingestion of the different workflows using the `metadata` CLI [here](run-postgres-connector-with-the-cli.md).
