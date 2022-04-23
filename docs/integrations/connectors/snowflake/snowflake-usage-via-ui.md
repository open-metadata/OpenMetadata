---
description: >-
  This guide will help you install and configure the Snowflake Usage connector
  and run usage ingestion workflows.
---

# Snowflake Usage via UI

In order to run the Snowflake usage ingestion workflows, the Snowflake metadata ingestion workflow must be set up first. Configure and schedule Snowflake Usage ingestion workflows from the **OpenMetadata UI**:

1. [Requirements](snowflake-usage-via-ui.md#1.-ensure-your-system-meets-the-requirements)
2. [Visit the _Services_ page](snowflake-usage-via-ui.md#2.-visit-the-services-page)
3. [Initiate new service creation](snowflake-usage-via-ui.md#3.-initiate-a-new-service-creation)
4. [Select service type](snowflake-usage-via-ui.md#4.-select-service-type)
5. [Name and describe your service](snowflake-usage-via-ui.md#5.-name-and-describe-your-service)
6. [Configure service connection](snowflake-usage-via-ui.md#6.-configure-service-connection)
7. [Configure metadata ingestion](snowflake-usage-via-ui.md#7.-configure-metadata-ingestion)
8. [Schedule for ingestion and deploy](snowflake-usage-via-ui.md#8.-schedule-for-ingestion-and-deploy)
9. [Configure usage ingestion](snowflake-usage-via-ui.md#9.-add-usage-ingestion)
10. [Schedule usage ingestion and deploy](snowflake-usage-via-ui.md#10.-schedule-usage-ingestion)

## **1. Requirements**

Please ensure that your host system meets the requirements listed below.

### **OpenMetadata (version 0.10 or later)**

To deploy OpenMetadata, follow the procedure [Try OpenMetadata in Docker](../../../overview/run-openmetadata/).

## 2. Visit the _Services_ page

You may configure scheduled ingestion workflows from the _Services_ page in the OpenMetadata UI. To visit the _Services_ page, select _Services_ from the _Settings_ menu.

![](<../../../.gitbook/assets/image (39) (2).png>)

## 3. Initiate a new service creation

Click on the _Add New Service_ button to add your Snowflake service to OpenMetadata for metadata ingestion.

![](<../../../.gitbook/assets/image (34) (1).png>)

## 4. Select service type

Select Snowflake as the service type and click _Next_.

![](<../../../.gitbook/assets/image (12).png>)

## 5. Name and describe your service

Provide a name and description for your service as illustrated below.

#### Service Name

OpenMetadata uniquely identifies services by their _Service Name_. Provide a name that distinguishes your deployment from other services, including the other Snowflake Usage services that you might be ingesting metadata from.

#### Description

Provide a description for your Snowflake Usage service that enables other users to determine whether it might provide data of interest to them.

![](../../../.gitbook/assets/image.png)

## 6. Configure service connection

In this step, we will configure the connection settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Snowflake Usage service as desired. Once the credentials have been added, click on **Test Connection** and Save the changes.

![](<../../../.gitbook/assets/image (54).png>)

#### Username

Enter username of your Snowflake Usage user in the _Username_ field. The user specified should be authorized to read all databases you want to include in the metadata ingestion workflow.

#### Password

Enter the password for your Snowflake Usage user in the _Password_ field.

#### Host and Port

Enter fully qualified host name and port number for your Snowflake Usage deployment in the _Host and Port_ field.

#### Account

Enter the details for the Snowflake Usage _Account_.

#### Role (Optional)

Enter the details of the Snowflake Usage Account _Role_. This is an optional detail.

#### Database (optional)

If you want to limit metadata ingestion to a single database, enter the name of this database in the Database field. If no value is entered for this field, the connector will ingest metadata from all databases that the specified user is authorized to read.

#### Warehouse (Optional)

Enter the details of the Snowflake Usage warehouse. This is an optional requirement.

#### Connection Options (Optional)

Enter the details for any additional connection options that can be sent to Snowflake Usage during the connection. These details must be added as Key Value pairs.

#### Connection Arguments (Optional)

Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Snowflake Usage during the connection. These details must be added as Key Value pairs.

In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key Value pair as follows.

`"authenticator" : "sso_login_url"`

In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key Value pair as follows.

`"authenticator" : "externalbrowser"`

#### Supports Profiler

Choose to support the data profiler.

## 7. Configure metadata ingestion

In this step we will configure the metadata ingestion settings for your Snowflake Usage deployment. Please follow the instructions below to ensure that you've configured the connector to read from your Snowflake Usage service as desired.

![](<../../../.gitbook/assets/image (1).png>)

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

When enabled, the data profiler will run as part of metadata ingestion. Running the data profiler increases the amount of time it takes for metadata ingestion, but provides the benefits mentioned above.

Set the _Enable data profiler_ toggle to the on position to enable the data profiler.

**Ingest sample data (toggle)**

Set the _Ingest sample data_ toggle to the on position to control whether or not to generate sample data to include in table views in the OpenMetadata user interface.

## 8. Schedule for ingestion and deploy

Scheduling can be set up at an hourly, daily, or weekly cadence. The timezone is in UTC. Select a Start Date to schedule for ingestion. It is optional to add an End Date.

![](<../../../.gitbook/assets/image (2).png>)

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

Review your configuration settings. If they match what you intended, click _Deploy_ to create the service and schedule metadata ingestion.

If something doesn't look right, click the _Back_ button to return to the appropriate step and change the settings as needed.

![](<../../../.gitbook/assets/image (36).png>)

## 9. Configure usage ingestion

Once the metadata ingestion has been deployed successfully, click on **Add Usage Ingestion**.

![](<../../../.gitbook/assets/image (17).png>)

Enter the following details and click Next.

![](<../../../.gitbook/assets/image (34).png>)

#### Query Log Duration

Specify the duration in days for which the profiler should capture usage data from the query logs. For example, if you specify 2 as the value for duration, the data profiler will capture usage information for the 48 hours prior to when the ingestion workflow is run.

#### Stage File Location

Mention the absolute file path of the temporary file name to store the query logs before processing.

#### &#x20;Result Limit

Set the limit for the query log results to be run at a time.

## 10. Schedule usage ingestion and deploy

Scheduling can be set up at an hourly, daily, or weekly cadence. The timezone is in UTC. Select a Start Date to schedule the usage ingestion. It is optional to add an End Date. Click on Deploy.

![](<../../../.gitbook/assets/image (4).png>)

Click on View Service to check the ingestion details.

![](<../../../.gitbook/assets/image (6).png>)

![](<../../../.gitbook/assets/image (20).png>)
