---
title: ADLS |Official Documentation
description: Connect Azure Data Lake Storage to OpenMetadata with our comprehensive ADLS connector guide. Setup instructions, configuration, and metadata extraction.
slug: /connectors/storage/adls
collate: true
---

{% connectorDetailsHeader
name="ADLS"
stage="PROD"
platform="Collate"
availableFeatures=["Metadata", "Structured Containers"]
unavailableFeatures=["Unstructured Containers"]
/ %}

This page contains the setup guide and reference information for the ADLS connector.

Configure and schedule ADLS metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Troubleshooting](/connectors/storage/adls/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/storage/adls/yaml"} /%}

## Requirements

We need the following permissions in Azure Data Lake Storage:

### ADLS Permissions

To extract metadata from Azure ADLS (Storage Account - StorageV2), you will need an **App Registration** with the following permissions on the Storage Account:
- Storage Blob Data Contributor
- Storage Queue Data Contributor


### OpenMetadata Manifest

In any other connector, extracting metadata happens automatically. In this case, we will be able to extract high-level
metadata from buckets, but in order to understand their internal structure we need users to provide an `openmetadata.json`
file at the bucket root.

`Supported File Formats: [ "csv",  "tsv", "avro", "parquet", "json", "json.gz", "json.zip" ]`

You can learn more about this [here](/connectors/storage). Keep reading for an example on the shape of the manifest file.

{% partial file="/v1.7/connectors/storage/manifest.md" /%}

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
src="/images/v1.7/connectors/visit-services-page.png"
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
src="/images/v1.7/connectors/create-new-service.png"
alt="Create a new service"
caption="Add a new Service from the Storage Services page" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=3 %}

{% stepDescription title="3. Select the Service Type" %}

Select ADLS as the service type and click Next.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.7/connectors/adls/select-service.png"
  alt="Select Service"
  caption="Select your service from the list" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=4 %}

{% stepDescription title="4. Name and Describe your Service" %}

Provide a name and description for your service.

#### Service Name

OpenMetadata uniquely identifies services by their Service Name. Provide
a name that distinguishes your deployment from other services, including
the other Storage services that you might be ingesting metadata
from.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.7/connectors/adls/add-new-service.png"
  alt="Add New Service"
  caption="Provide a Name and description for your Service" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=5 %}

{% stepDescription title="5. Configure the Service Connection" %}

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your ADLS service as
desired.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.7/connectors/adls/service-connection.png"
  alt="Configure service connection"
  caption="Configure the service connection by filling the form" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

**Client ID**: This unique identifier is assigned to your Azure Service Principal App, serving as a key for authentication and authorization.

**Client Secret**: This confidential password is associated with the Service Principal, safeguarding access to Azure resources and ensuring secure communication.

**Tenant ID**: Identifying your Azure Subscription, the Tenant ID links your resources to a specific organization or account within the Azure Active Directory.

**Storage Account Name**: This is the user-defined name for your Azure Storage Account, providing a globally unique namespace for your data.

**Key Vault Name**: Azure Key Vault serves as a centralized secrets manager, securely storing and managing sensitive information, such as connection strings and cryptographic keys.

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/storage/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
