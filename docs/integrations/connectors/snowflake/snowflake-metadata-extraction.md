---
description: >-
  This guide will help you configure metadata ingestion workflows using the
  Snowflake connector.
---

# Snowflake in the UI

1. [Ensure your system meets the requirements](snowflake-metadata-extraction.md#1.-requirements)
2. [Visit the Services page](snowflake-metadata-extraction.md#2.-visit-the-services-page)
3. [Initiate new service creation](snowflake-metadata-extraction.md#3.-initiate-a-new-service-creation)
4. [Select service type](snowflake-metadata-extraction.md#4.-select-service-type)
5. [Name and describe your service](snowflake-metadata-extraction.md#5.-name-and-describe-your-service)
6. [Configure service connection](snowflake-metadata-extraction.md#6.-configure-service-connection)
7. [Configure metadata ingestion](snowflake-metadata-extraction.md#7.-configure-metadata-ingestion)
8. [Review configuration and save](snowflake-metadata-extraction.md#8.-review-configuration-and-save)

## **1. Ensure your system meets the requirements**

Please ensure that your host system meets the requirements listed below.

### **OpenMetadata (version 0.9.0 or later)**

To deploy OpenMetadata, follow the procedure [Try OpenMetadata in Docker](../../../overview/run-openmetadata/).

## 2. Visit the _Services_ page

You may configure scheduled ingestion workflows from the _Services_ page in the OpenMetadata UI. To visit the _Services_ page, select _Services_ from the _Settings_ menu.

![](<../../../.gitbook/assets/image (16) (1) (1) (1).png>)

## 3. Initiate a new service creation

From the Database Service UI, click the _Add New Service_ button to add your Snowflake service to OpenMetadata for metadata ingestion.

![](<../../../.gitbook/assets/image (30).png>)

## 4. Select service type

Select Snowflake as the service type.

![](<../../../.gitbook/assets/image (60) (1).png>)

## 5. Name and describe your service

Provide a name and description for your service as illustrated below.

#### Name

OpenMetadata uniquely identifies services by their _Name_. Provide a name that distinguishes your deployment from other services, including other Snowflake services that you might be ingesting metadata from.

#### Description

Provide a description for your Snowflake service that enables other users to determine whether it might provide data of interest to them.

![](<../../../.gitbook/assets/image (65).png>)

## 6. Configure service connection

In this step, we will configure the connection settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Snowflake service as desired.

![](<../../../.gitbook/assets/image (62).png>)

#### Host

Enter fully qualified hostname for your Snowflake deployment in the _Host_ field.

#### Port

Enter the port number on which your Snowflake deployment listens for client connections in the _Port_ field.

#### Username

Enter username of your Snowflake user in the _Username_ field. The user specified should be authorized to read all databases you want to include in the metadata ingestion workflow.

#### Password

Enter the password for your Snowflake user in the _Password_ field.&#x20;

#### Database (optional)

If you want to limit metadata ingestion to a single database, enter the name of this database in the Database field. If no value is entered for this field, the connector will ingest metadata from all databases that the specified user is authorized to read.

## 7. Configure metadata ingestion

In this step we will configure the metadata ingestion settings for your Snowflake deployment. Please follow the instructions below to ensure that you've configured the connector to read from your Snowflake service as desired.

![](<../../../.gitbook/assets/image (27).png>)

#### Ingestion name

OpenMetadata will pre-populate the _Ingestion name_ field. You may modify the _Ingestion name,_ but if you do, please ensure it is unique for this service.

#### Include (Table Filter Pattern)

Use to table filter patterns to control whether or not to include tables as part of metadata ingestion and data profiling.

Explicitly include tables by adding a list of comma-separated regular expressions to the _Include_ field. OpenMetadata will include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded. See the figure above for an example.

#### Exclude (Table Filter Pattern)

Explicitly exclude tables by adding a list of comma-separated regular expressions to the _Exclude_ field. OpenMetadata will exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included. See the figure above for an example.&#x20;

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

## 8. Review configuration and save

Review your configuration settings. If they match what you intended, click Save to create the service and schedule metadata ingestion.

If something doesn't look right, click the _Previous_ button to return to the appropriate step and change the settings as needed.

![](<../../../.gitbook/assets/image (58).png>)





