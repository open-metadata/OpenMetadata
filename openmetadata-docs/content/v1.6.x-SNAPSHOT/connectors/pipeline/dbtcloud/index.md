---
title: DBTCloud
slug: /connectors/pipeline/dbtcloud
---

{% connectorDetailsHeader
name="DBTCloud"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage"]
unavailableFeatures=["Owners", "Tags"]
/ %}


In this section, we provide guides and references to use the DBTCloud connector.

Configure and schedule DBTCloud metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
    - [DBTCloud Versions](#dbtcloud-versions)
- [Metadata Ingestion](#metadata-ingestion)
    - [Service Name](#service-name)
    - [Connection Details](#connection-details)
    - [Metadata Ingestion Options](#metadata-ingestion-options)
- [Troubleshooting](#troubleshooting)
    - [Workflow Deployment Error](#workflow-deployment-error)

{% partial file="/v1.5/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/dbtcloud/yaml"} /%}

## Requirements

### DBTCloud Versions

OpenMetadata is integrated with DBT cloud up to version [1.8](https://docs.getdbt.com/docs/get-started-dbt) and will continue to work for future DBT cloud versions.

The Ingestion framework uses [DBT Cloud APIs](https://docs.getdbt.com/dbt-cloud/api-v2#/) to connect to the dbtcloud  and fetch metadata.

### DBTCloud Permissions

The DBT Clous API User token or Service account token must have the permission to fetch Metadata.
To know more about permissions required refer [here](https://docs.getdbt.com/docs/dbt-cloud-apis/service-tokens#permissions-for-service-account-tokens).

### DBTCloud Account

- DBT Cloud [multi-tenant](https://docs.getdbt.com/docs/cloud/about-cloud/tenancy#multi-tenant) or [single tenant](https://docs.getdbt.com/docs/cloud/about-cloud/tenancy#single-tenant) account is required.
- You must be on a [Team or Enterprise plan](https://www.getdbt.com/pricing/).
- Your projects must be on dbt version 1.0 or later. Refer to [Upgrade dbt version in Cloud](https://docs.getdbt.com/docs/dbt-versions/upgrade-dbt-version-in-cloud) to upgrade.

## Metadata Ingestion

{% partial 
    file="/v1.5/connectors/metadata-ingestion-ui.md" 
    variables={
        connector: "DBTCloud", 
        selectServicePath: "/images/v1.5/connectors/dbtcloud/select-service.webp",
        addNewServicePath: "/images/v1.5/connectors/dbtcloud/add-new-service.webp",
        serviceConnectionPath: "/images/v1.5/connectors/dbtcloud/service-connection.webp",
    } 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host**: DBT cloud Access URL eg.`https://abc12.us1.dbt.com`. Go to your dbt cloud account settings to know your Access URL.

- **Discovery API URL** : DBT cloud Access URL eg. `https://metadata.cloud.getdbt.com/graphql`. Go to your dbt cloud account settings to know your Discovery API url.

- **Account Id** : The Account ID of your DBT cloud Project. Go to your dbt cloud account settings to know your Account Id. This will be a numeric value but in openmetadata we parse it as a string.

- **Job Id** : Optional. The Job ID of your DBT cloud Job in your Project to fetch metadata for. Look for the segment after "jobs" in the URL. For instance, in a URL like `https://cloud.getdbt.com/accounts/123/projects/87477/jobs/73659994`, the job ID is `73659994`. This will be a numeric value but in openmetadata we parse it as a string. If not passed all Jobs under the Account id will be ingested.

- **Token** : The Authentication Token of your DBT cloud API Account. To get your access token you can follow the docs [here](https://docs.getdbt.com/docs/dbt-cloud-apis/authentication).
Make sure you have the necessary permissions on the token to run graphql queries and get job and run details. 

{% /extraContent %}

{% partial file="/v1.5/connectors/test-connection.md" /%}

{% partial file="/v1.5/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.5/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Displaying Lineage Information
Steps to retrieve and display the lineage information for a DBT Cloud service. Note that only the metadata from the last run will be used for lineage.
1. Ingest Source and Sink Database Metadata: Identify both the source and sink database used by the DBT Cloud service for example Redshift. Ingest metadata for these database.
2. Ingest DBT Cloud Service Metadata: Finally, Ingest your DBT Cloud service.

By successfully completing these steps, the lineage information for the service will be displayed.

{% image
  src="/images/v1.5/connectors/dbtcloud/lineage.webp"
  alt="DBT Cloud Lineage" /%}



{% partial file="/v1.5/connectors/troubleshooting.md" /%}

### Missing Lineage
If lineage information is not displayed for a DBT Cloud service, follow these steps to diagnose the issue.
1. *DBT Cloud Account*: Make sure that the DBT cloud instance you are ingesting have the necessary permissions to fetch jobs and run graphql queries over the API.
2. *Metadata Ingestion*: Ensure that metadata for both the source and sink database is ingested and passed to the lineage system. This typically involves configuring the relevant connectors to capture and transmit this information.
3. *Last Run Successful*: Ensure that the Last Run for a Job is successful as OpenMetadata gets the metadata required to build the lineage using the last Run under a Job.
