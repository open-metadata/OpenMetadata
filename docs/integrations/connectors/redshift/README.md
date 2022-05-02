---
description: >-
  In this section, we provide guides and reference to use the Redshift
  connector.
---

# Redshift

Configure and schedule Redshift **metadata**, **usage**, and **profiler** workflows from the OpenMetadata UI.

* [Requirements](./#requirements)
* [Metadata Ingestion](./#metadata-ingestion)
* [Query Usage and Lineage Ingestion](./#query-usage-and-lineage-ingestion)
* [Data Profiler and Quality Tests](./#data-profiler-and-quality-tests)
* [DBT Integration](./#dbt-integration)

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check the following docs to connect using Airflow SDK or with the CLI.

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

Select Redshift as the service type and click _Next_.

![](../../../.gitbook/assets/redshift-create-service.jpg)

### 4. Name and Describe your Service

Provide a name and description for your service as illustrated below.

#### Service Name

OpenMetadata uniquely identifies services by their _Service Name_. Provide a name that distinguishes your deployment from other services, including the other Redshift services that you might be ingesting metadata from.



![](../../../.gitbook/assets/create-service.jpg)

### 5. Configure the Service Connection

In this step, we will configure the connection settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Redshift service as desired.

![Configure the Service Connection](../../../.gitbook/assets/redshift-connection.jpg)

<details>

<summary>Connection Options</summary>

#### Host and Port

This is the Redshift APIs URL.

#### Username&#x20;

Specify the User to connect to Redshift. It should have enough privileges to read all the metadata.

#### Password (Optional)

This is the password for connecting to Redshift.&#x20;

#### Database (Optional)

The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.

#### Connection Options (Optional)

Enter the details for any additional connection options that can be sent to Redshift during the connection. These details must be added as Key-Value pairs.

#### Connection Arguments (Optional)

Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Redshift during the connection. These details must be added as Key-Value pairs.

Here is where we can configure the SSL options. The key should be `sslmode` and accepts the following values:

* `verify-ca`: The Redshift connector will verify that the server is trustworthy by checking the certificate chain up to a trusted certificate authority (CA).
* `verify-full`: The Redshift connector will also verify that the server hostname matches its certificate. The SSL connection will fail if the server certificate cannot be verified. `verify-full` is recommended in most security-sensitive environments.
* `require`: If a root CA file exists, the behavior of `sslmode=require` will be the same as that of `verify-ca`, meaning the server certificate is validated against the CA. Relying on this behavior is discouraged, and applications that need certificate validation should always use `verify-ca` or `verify-full`.&#x20;

In `verify-full` mode, the cn (Common Name) attribute of the certificate is matched against the hostname. If the cn attribute starts with an asterisk (\*), it will be treated as a wildcard, and will match all characters except a dot (.). This means the certificate will not match subdomains. If the connection is made using an IP address instead of a hostname, the IP address will be matched (without doing any DNS lookups).

You can find more information in the AWS [docs](https://docs.aws.amazon.com/redshift/latest/mgmt/connecting-ssl-support.html).

</details>

After hitting Save you will see that your Redshift connector has been added successfully, and you can add an ingestion.

![Service has been saved](<../../../.gitbook/assets/image (17) (3).png>)

### 6. Configure the Metadata Ingestion

Once the service is created, we can add a **Metadata Ingestion Workflow**, either directly from the _Add Ingestion_ button in the figure above, or from the Service page:

![Add a Metadata Ingestion Workflow from the Service Page](<../../../.gitbook/assets/image (39).png>)

<details>

<summary>Metadata Ingestion Options</summary>

#### Include (Table Filter Pattern)

Use table filter patterns to control whether or not to include tables as part of metadata ingestion and data profiling.

Explicitly include tables by adding a list of comma-separated regular expressions to the _Include_ field. OpenMetadata will include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded. See the figure above for an example.

#### Exclude (Table Filter Pattern)

Explicitly exclude tables by adding a list of comma-separated regular expressions to the _Exclude_ field. OpenMetadata will exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included. See the figure above for an example.

#### Include (Schema Filter Pattern)

Use schema filter patterns to control whether or not to include schemas as part of metadata ingestion and data profiling.

Explicitly include schemas by adding a list of comma-separated regular expressions to the _Include_ field. OpenMetadata will include all schemas with names matching one or more of the supplied regular expressions. All other schemas will be excluded.

#### Exclude (Schema Filter Pattern)

Explicitly exclude schemas by adding a list of comma-separated regular expressions to the _Exclude_ field. OpenMetadata will exclude all schemas with names matching one or more of the supplied regular expressions. All other schemas will be included.

**Include views (toggle)**

Set the _Include views to_ toggle to the on position to control whether or not to include views as part of metadata ingestion and data profiling.

Explicitly include views by adding the following key-value pair in the `source.config` field of your configuration file.

**Enable data profiler (toggle)**

The data profiler ingests usage information for tables. This enables you to assess the frequency of use, reliability, and other details.

When enabled, the data profiler will run as part of metadata ingestion. Running the data profiler increases the amount of time it takes for metadata ingestion but provides the benefits mentioned above.

Set the _Enable data profiler_ toggle to the on position to enable the data profiler.

**Ingest sample data (toggle)**

Set the _Ingest sample data to_ toggle to the on position to control whether or not to generate sample data to include in table views in the OpenMetadata user interface.

</details>

### 7. Schedule the Ingestion and Deploy

Scheduling can be set up at an hourly, daily, or weekly cadence. The timezone is in UTC. Select a Start Date to schedule for ingestion. It is optional to add an End Date.

Review your configuration settings. If they match what you intended, click _Deploy_ to create the service and schedule metadata ingestion.

If something doesn't look right, click the _Back_ button to return to the appropriate step and change the settings as needed.

![Schedule the Ingestion Pipeline and Deploy](<../../../.gitbook/assets/image (21) (1).png>)

<details>

<summary><strong>Schedule Options</strong></summary>

**Every**

Use the _Every_ drop-down menu to select the interval at which you want to ingest metadata. Your options are as follows:

* _Hour_: Ingest metadata once per hour
* _Day_: Ingest metadata once per day
* _Week_: Ingest metadata once per week

**Day**

The _Day_ selector is only active when ingesting metadata once per week. Use the _Day_ selector to set the day of the week on which to ingest metadata.

**Minute**

The _Minute_ dropdown is only active when ingesting metadata once per hour. Use the _Minute_ drop-down menu to select the minute of the hour at which to begin ingesting metadata.

**Time**

The _Time_ drop-down menus are active when ingesting metadata either once per day or once per week. Use the time drop-downs to select the time of day at which to begin ingesting metadata.

**Start date (UTC)**

Use the _Start date_ selector to choose the date at which to begin ingesting metadata according to the defined schedule.

**End date (UTC)**

Use the _End date_ selector to choose the date at which to stop ingesting metadata according to the defined schedule. If no end date is set, metadata ingestion will continue according to the defined schedule indefinitely.

</details>

After configuring the workflow, you can click on _Deploy_ to create the pipeline.

### 8. View the Ingestion Pipeline

Once the workflow has been successfully deployed, you can view the Ingestion Pipeline running from the Service Page.

![View the Ingestion Pipeline from the Service Page](<../../../.gitbook/assets/image (43) (2).png>)

### 9. Workflow Deployment Error

If there were any errors during the workflow deployment process, the Ingestion Pipeline Entity will still be created, but no workflow will be present in the Ingestion container.

You can then edit the Ingestion Pipeline and _Deploy_ it again.

![Edit and Deploy the Ingestion Pipeline](<../../../.gitbook/assets/image (8) (2).png>)

From the _Connection_ tab, you can also _Edit_ the Service if needed.

## Query Usage and Lineage Ingestion

You can learn more about how to configure the Usage Workflow to ingest Query and Lineage information from the UI below:

{% content-ref url="../../../data-lineage/usage-workflow.md" %}
[usage-workflow.md](../../../data-lineage/usage-workflow.md)
{% endcontent-ref %}

## Data Profiler and Quality Tests

You can learn more about how to configure the Data Profiler and about executing Data Quality tests from the UI below:

{% content-ref url="../../../data-quality/profiler-workflow.md" %}
[profiler-workflow.md](../../../data-quality/profiler-workflow.md)
{% endcontent-ref %}

## DBT Integration

You can learn more about how to ingest DBT models' definitions and their lineage below:

{% content-ref url="../../../data-lineage/dbt-integration.md" %}
[dbt-integration.md](../../../data-lineage/dbt-integration.md)
{% endcontent-ref %}

## Run using Airflow SDK

You can learn more about how to host and run the different workflows on your own Airflow instances below:

{% content-ref url="redshift-metadata-extraction.md" %}
[redshift-metadata-extraction.md](redshift-metadata-extraction.md)
{% endcontent-ref %}

## One-time ingestion with the CLI

You can learn more about how to run a one-time ingestion of the different workflows using the `metadata` CLI below:

{% content-ref url="redshift-usage.md" %}
[redshift-usage.md](redshift-usage.md)
{% endcontent-ref %}
