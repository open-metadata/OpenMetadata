---
title: Datalake
slug: /openmetadata/connectors/database/datalake
---

<ConnectorIntro connector="Datalake" goal="Airflow" />

<Requirements />


## Metadata Ingestion

### 1. Visit the Services Page


The first step is ingesting the metadata from your sources. Under Settings you will find a **Services** link an external source system to OpenMetadata. Once a service is created, it can be used to configure metadata, usage, and profiler workflows.

To visit the _Services_ page, select _Services_ from the _Settings_ menu.


![Navigate to Settings >> Services](<https://raw.githubusercontent.com/open-metadata/OpenMetadata/0.10.1-docs/.gitbook/assets/image%20(14).png>)



### 2. Create a New Service

Click on the _Add New Service_ button to start the Service creation.


<Image src="/images/openmetadata/connectors/datalake/create-new-service.png" alt="create-new-service"/>

### 3. Select the Service Type

Select Datalake as the service type and click _Next_.

<Image src="/images/openmetadata/connectors/datalake/select-service.png" alt="select-service"/>

### 4. Name and Describe your Service

Provide a name and description for your service as illustrated below.

<Image src="/images/openmetadata/connectors/datalake/describe-service.png" alt="describe-service"/>

#### Service Name

OpenMetadata uniquely identifies services by their _Service Name_. Provide a name that distinguishes your deployment from other services, including the other Datalake services that you might be ingesting metadata from.

### 5. Configure the Service Connection

In this step, we will configure the connection settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Datalake service as desired.

**Datalake using AWS S3**

<Image src="/images/openmetadata/connectors/datalake/service-connection-using-aws-s3.png" alt="create-account"/>

<details>

<summary>Connection Options for AWS S3</summary>

**AWS Access Key ID**

Enter your secure access key ID for your DynamoDB connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.

**AWS Secret Access Key**

Enter the Secret Access Key (the passcode key pair to the key ID from above).

**AWS Region**

Specify the region in which your DynamoDB is located.

Note: This setting is required even if you have configured a local AWS profile.

**AWS Session Token**

The AWS session token is an optional parameter. If you want, enter the details of your temporary session token.

**Endpoint URL (optional)**

The DynamoDB connector will automatically determine the DynamoDB endpoint URL based on the AWS Region. You may specify a value to override this behavior.

**Database (Optional)**

The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.

**Connection Options (Optional)**

Enter the details for any additional connection options that can be sent to DynamoDB during the connection. These details must be added as Key-Value pairs.

**Connection Arguments (Optional)**

Enter the details for any additional connection arguments such as security or protocol configs that can be sent to DynamoDB during the connection. These details must be added as Key-Value pairs.

In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows.

`"authenticator" : "sso_login_url"`

In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows.

`"authenticator" : "externalbrowser"`

</details>

**Datalake using GCS**

<Image src="/images/openmetadata/connectors/datalake/service-connection-using-gcs.png" alt="service-connection-using-gcs"/>


<details>

<summary>Connection Options for GCS</summary>

**BUCKET NAME**

This is the Bucket Name in GCS.

**PREFIX**

This is the Bucket Name in GCS.

**GCS Credentials**

We support two ways of authenticating to BigQuery:

1. Passing the raw credential values provided by BigQuery. This requires us to provide the following information, all provided by BigQuery:
   1. Credentials type, e.g. `service_account`.
   2. Project ID
   3. Private Key ID
   4. Private Key
   5. Client Email
   6. Client ID
   7. Auth URI, [https://accounts.google.com/o/oauth2/auth](https://accounts.google.com/o/oauth2/auth) by default
   8. Token URI, [https://oauth2.googleapis.com/token](https://oauth2.googleapis.com/token) by default
   9. Authentication Provider X509 Certificate URL, [https://www.googleapis.com/oauth2/v1/certs](https://www.googleapis.com/oauth2/v1/certs) by default
   10. Client X509 Certificate URL

</details>

After hitting Save you will see that your Datalake connector has been added successfully, and you can add an ingestion.

<Image src="/images/openmetadata/connectors/datalake/created-service.png" alt="created-service"/>

### 6. Configure the Metadata Ingestion

Once the service is created, we can add a **Metadata Ingestion Workflow**, either directly from the _Add Ingestion_ button in the figure above, or from the Service page:

<Image src="/images/openmetadata/connectors/datalake/service-page.png" alt="service-page"/>

<details>

<summary>Metadata Ingestion Options</summary>

**Include (Table Filter Pattern)**

Use to table filter patterns to control whether or not to include tables as part of metadata ingestion and data profiling.

Explicitly include tables by adding a list of comma-separated regular expressions to the _Include_ field. OpenMetadata will include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded. See the figure above for an example.

**Exclude (Table Filter Pattern)**

Explicitly exclude tables by adding a list of comma-separated regular expressions to the _Exclude_ field. OpenMetadata will exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included. See the figure above for an example.

**Include (Schema Filter Pattern)**

Use to schema filter patterns to control whether or not to include schemas as part of metadata ingestion and data profiling.

Explicitly include schemas by adding a list of comma-separated regular expressions to the _Include_ field. OpenMetadata will include all schemas with names matching one or more of the supplied regular expressions. All other schemas will be excluded.

**Exclude (Schema Filter Pattern)**

Explicitly exclude schemas by adding a list of comma-separated regular expressions to the _Exclude_ field. OpenMetadata will exclude all schemas with names matching one or more of the supplied regular expressions. All other schemas will be included.

**Include views (toggle)**

Set the _Include views_ toggle to the on position to control whether or not to include views as part of metadata ingestion and data profiling.

Explicitly include views by adding the following key-value pair in the `source.config` field of your configuration file.

**Enable data profiler (toggle)**

Glue does not provide querying capabilities, so the data profiler is not supported.

**Ingest sample data (toggle)**

Glue does not provide querying capabilities, so sample data is not supported.

</details>


<Image src="/images/openmetadata/connectors/datalake/deployed-service.png" alt="deploy-service"/>

### 7. Schedule the Ingestion and Deploy

Scheduling can be set up at an hourly, daily, or weekly cadence. The timezone is in UTC. Select a Start Date to schedule for ingestion. It is optional to add an End Date.

Review your configuration settings. If they match what you intended, click _Deploy_ to create the service and schedule metadata ingestion.

If something doesn't look right, click the _Back_ button to return to the appropriate step and change the settings as needed.

<details>

<summary><strong>Scheduling Options</strong></summary>

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

</details>

After configuring the workflow, you can click on _Deploy_ to create the pipeline.

<Image src="/images/openmetadata/connectors/datalake/schedule-options.png" alt="schedule-options"/>



### 8. View the Ingestion Pipeline

Once the workflow has been successfully deployed, you can view the Ingestion Pipeline running from the Service Page.

<Image src="/images/openmetadata/connectors/datalake/ingestion-pipeline.png" alt="ingestion-pipeline"/>

### 9. Workflow Deployment Error

If there were any errors during the workflow deployment process, the Ingestion Pipeline Entity will still be created, but no workflow will be present in the Ingestion container.

You can then edit the Ingestion Pipeline and _Deploy_ it again.

<Image src="/images/openmetadata/connectors/datalake/workflow-deployment-error.png" alt="create-account"/>

From the _Connection_ tab, you can also _Edit_ the Service if needed.



<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Datalake" goal="Airflow"  />
