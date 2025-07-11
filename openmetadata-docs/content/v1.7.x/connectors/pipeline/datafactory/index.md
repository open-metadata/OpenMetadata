---
title: Datafactory |Official Documentation
description: Get started with datafactory. Setup instructions, features, and configuration details inside.
slug: /connectors/pipeline/datafactory
collate: true
---

{% connectorDetailsHeader
name="Azure Data Factory"
stage="PROD"
platform="Collate"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage"]
unavailableFeatures=["Owners", "Tags"]
/ %}


In this section, we provide guides and references to use the Azure Data Factory connector.

Configure and schedule Azure Data Factory metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
    - [Data Factory Versions](#data-factory-versions)
- [Metadata Ingestion](#metadata-ingestion)
    - [Service Name](#service-name)
    - [Connection Details](#connection-details)
    - [Metadata Ingestion Options](#metadata-ingestion-options)
- [Troubleshooting](/connectors/pipeline/datafactory/troubleshooting)
    - [Workflow Deployment Error](#workflow-deployment-error)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/datafactory/yaml"} /%}

## Requirements

### Data Factory Versions

The Ingestion framework uses [Azure Data Factory APIs](https://learn.microsoft.com/en-us/rest/api/datafactory/v2) to connect to the Data Factory and fetch metadata.

You can find further information on the Azure Data Factory connector in the [docs](https://docs.open-metadata.org/connectors/pipeline/datafactory).

## Permissions

Ensure that the service principal or managed identity you’re using has the necessary permissions in the Data Factory resource (Reader, Contributor or Data Factory Contributor role at minimum).


## Metadata Ingestion

{% partial 
    file="/v1.7/connectors/metadata-ingestion-ui.md" 
    variables={
        connector: "DataFactory", 
        selectServicePath: "/images/v1.7/connectors/datafactory/select-service.png",
        addNewServicePath: "/images/v1.7/connectors/datafactory/add-new-service.png",
        serviceConnectionPath: "/images/v1.7/connectors/datafactory/service-connection.png",
    } 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Subscription ID**: Your Azure subscription’s unique identifier. In the Azure portal, navigate to Subscriptions > Your Subscription > Overview. You’ll see the subscription ID listed there.

- **Resource Group name** : This is the name of the resource group that contains your Data Factory instance. In the Azure portal, navigate to Resource Groups. Find your resource group, and note the name.

- **Azure Data Factory name** : The name of your Data Factory instance. In the Azure portal, navigate to Data Factories and find your Data Factory. The Data Factory name will be listed there.

- **Azure Data Factory pipeline runs day filter** : The days range when filtering pipeline runs. It specifies how many days back from the current date to look for pipeline runs, and filter runs within the given period of days. Default is `7` days. `Optional`


## Azure Data Factory Configuration

- **Client ID** : To get the Client ID (also known as application ID), follow these steps:

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for this connection.
4. From the Overview section, copy the `Application (client) ID`.


- **Client Secret** : To get the client secret, follow these steps:

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for this connection.
4. Under `Manage`, select `Certificates & secrets`.
5. Under `Client secrets`, select `New client secret`.
6. In the `Add a client secret` pop-up window, provide a description for your application secret. Choose when the application should expire, and select `Add`.
7. From the `Client secrets` section, copy the string in the `Value` column of the newly created application secret.


- **Tenant ID** : To get the tenant ID, follow these steps:

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Power BI.
4. From the `Overview` section, copy the `Directory (tenant) ID`.

- **Account Name** : Here are the step-by-step instructions for finding the account name for an Azure Data Lake Storage account:

1. Sign in to the Azure portal and navigate to the `Storage accounts` page.
2. Find the Data Lake Storage account you want to access and click on its name.
3. In the account overview page, locate the `Account name` field. This is the unique identifier for the Data Lake Storage account.
4. You can use this account name to access and manage the resources associated with the account, such as creating and managing containers and directories.



{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Displaying Lineage Information
Steps to retrieve and display the lineage information for a Data Factory service.
1. Ingest Source and Sink Database Metadata: Identify both the source and sink database used by the Azure Data Factory service for example Redshift. Ingest metadata for these database.
2. Ingest Data Factory Service Metadata: Finally, Ingest your DData Factory service.

By successfully completing these steps, the lineage information for the service will be displayed.

### Missing Lineage
If lineage information is not displayed for a Data Factory service, follow these steps to diagnose the issue.
1. *Permissions*: Ensure that the service principal or managed identity you’re using has the necessary permissions in the Data Factory resource. (Reader, Contributor or Data Factory Contributor role at minimum).
2. *Metadata Ingestion*: Ensure that metadata for both the source and sink database is ingested and passed to the lineage system. This typically involves configuring the relevant connectors to capture and transmit this information.
3. *Run Successful*: Ensure that the Pipeline Run is successful.
