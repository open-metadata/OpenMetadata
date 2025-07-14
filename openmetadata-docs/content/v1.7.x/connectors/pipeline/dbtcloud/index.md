---
title: dbt Cloud Connector | OpenMetadata Pipeline Integration
description: Connect dbt Cloud to OpenMetadata with our comprehensive pipeline connector guide. Setup instructions, configuration examples, and troubleshooting tips.
slug: /connectors/pipeline/dbtcloud
---

{% connectorDetailsHeader
name="dbt Cloud"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage", "Usage"]
unavailableFeatures=["Owners", "Tags"]
/ %}


In this section, we provide guides and references to use the dbt Cloud connector.

Configure and schedule dbt Cloud metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
    - [dbt Cloud Versions](#dbt-cloud-versions)
- [Metadata Ingestion](#metadata-ingestion)
    - [Service Name](#service-name)
    - [Connection Details](#connection-details)
    - [Metadata Ingestion Options](#metadata-ingestion-options)
- [Troubleshooting](/connectors/pipeline/dbtcloud/troubleshooting)
    - [Workflow Deployment Error](#workflow-deployment-error)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/dbtcloud/yaml"} /%}

## Requirements

### dbt Cloud Versions

OpenMetadata is integrated with dbt Cloud up to version [1.8](https://docs.getdbt.com/docs/get-started-dbt) and will continue to work for future dbt Cloud versions.

The Ingestion framework uses [dbt Cloud APIs](https://docs.getdbt.com/dbt-cloud/api-v2#/) to connect to the dbt Cloud and fetch metadata.

### dbt Cloud Permissions

The dbt Cloud API User token or Service account token must have the permission to fetch metadata.
To know more about permissions required refer [here](https://docs.getdbt.com/docs/dbt-cloud-apis/service-tokens#permissions-for-service-account-tokens).

### dbt Cloud Account

- dbt Cloud [multi-tenant](https://docs.getdbt.com/docs/cloud/about-cloud/tenancy#multi-tenant) or [single tenant](https://docs.getdbt.com/docs/cloud/about-cloud/tenancy#single-tenant) account is required.
- You must be on a [Team or Enterprise plan](https://www.getdbt.com/pricing/).
- Your projects must be on dbt version 1.0 or later. Refer to [Upgrade dbt version in Cloud](https://docs.getdbt.com/docs/dbt-versions/upgrade-dbt-version-in-cloud) to upgrade.

## Metadata Ingestion

{% partial 
    file="/v1.7/connectors/metadata-ingestion-ui.md" 
    variables={
        connector: "DBTCloud", 
        selectServicePath: "/images/v1.7/connectors/dbtcloud/select-service.png",
        addNewServicePath: "/images/v1.7/connectors/dbtcloud/add-new-service.png",
        serviceConnectionPath: "/images/v1.7/connectors/dbtcloud/service-connection.png",
    } 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host**: dbt cloud Access URL eg.`https://abc12.us1.dbt.com`. Go to your dbt Cloud account settings to know your Access URL.

- **Discovery API URL** : dbt Cloud Access URL eg. `https://metadata.cloud.getdbt.com/graphql`. Go to your dbt Cloud account settings to know your Discovery API url. Make sure you have `/graphql` at the end of your URL.

- **Account Id** : The Account ID of your dbt Cloud Project. Go to your dbt Cloud account settings to know your Account Id. This will be a numeric value but in openmetadata we parse it as a string.

- **Job Ids** : Optional. Job IDs of your dbt Cloud Jobs in your Project to fetch metadata for. Look for the segment after "jobs" in the URL. For instance, in a URL like `https://cloud.getdbt.com/accounts/123/projects/87477/jobs/73659994`, the job ID is `73659994`. This will be a numeric value but in openmetadata we parse it as a string. If not passed all Jobs under the Account id will be ingested.

- **Project Ids** : Optional. Project IDs of your dbt Cloud Account to fetch metadata for. Look for the segment after "projects" in the URL. For instance, in a URL like `https://cloud.getdbt.com/accounts/123/projects/87477/jobs/73659994`, the job ID is `87477`. This will be a numeric value but in openmetadata we parse it as a string. If not passed all Projects under the Account id will be ingested.

Note that if both `Job Ids` and `Project Ids` are passed then it will filter out the jobs from the passed projects. any `Job Ids` not belonging to the `Project Ids` will also be filtered out.

- **Token** : The Authentication Token of your dbt Cloud API Account. To get your access token you can follow the docs [here](https://docs.getdbt.com/docs/dbt-cloud-apis/authentication).
Make sure you have the necessary permissions on the token to run graphql queries and get job and run details. 

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Displaying Lineage Information
Steps to retrieve and display the lineage information for a dbt Cloud service. Note that only the metadata from the last run will be used for lineage.
1. Ingest Source and Sink Database Metadata: Identify both the source and sink database used by the dbt Cloud service for example Redshift. Ingest metadata for these database.
2. Ingest dbt Cloud Service Metadata: Finally, Ingest your dbt Cloud service.

By successfully completing these steps, the lineage information for the service will be displayed.

{% image
  src="/images/v1.7/connectors/dbtcloud/lineage.png"
  alt="dbt Cloud Lineage" /%}

### Missing Lineage
If lineage information is not displayed for a dbt Cloud service, follow these steps to diagnose the issue.
1. *dbt Cloud Account*: Make sure that the dbt Cloud instance you are ingesting have the necessary permissions to fetch jobs and run graphql queries over the API.
2. *Metadata Ingestion*: Ensure that metadata for both the source and sink database is ingested and passed to the lineage system. This typically involves configuring the relevant connectors to capture and transmit this information.
3. *Last Run Successful*: Ensure that the Last Run for a Job is successful as OpenMetadata gets the metadata required to build the lineage using the last Run under a Job.
