---
title: Run the ADLS Connector Externally
slug: /connectors/storage/adls/yaml
---

{% connectorDetailsHeader
name="ADLS"
stage="PROD"
platform="Collate"
availableFeatures=["Metadata"]
unavailableFeatures=[]
/ %}

This page contains the setup guide and reference information for the Azure connector.

Configure and schedule Azure metadata workflows from the CLI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.4/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 1.0 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To run the metadata ingestion, we need the following permissions in ADLS:

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

{% partial file="/v1.4/connectors/storage/manifest.md" /%}

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/storage/adlsConnection.json)
you can find the structure to create a connection to Athena.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Athena:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}
- **Client ID**: This is the unique identifier for your application registered in Azure AD. It’s used in conjunction with the Client Secret to authenticate your application.
{% /codeInfo %}

{% codeInfo srNumber=2 %}
- **Client Secret**: A key that your application uses, along with the Client ID, to access Azure resources.

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for this connection.
4. Under `Manage`, select `Certificates & secrets`.
5. Under `Client secrets`, select `New client secret`.
6. In the `Add a client secret` pop-up window, provide a description for your application secret. Choose when the application should expire, and select `Add`.
7. From the `Client secrets` section, copy the string in the `Value` column of the newly created application secret.


{% /codeInfo %}

{% codeInfo srNumber=3 %}
- **Tenant ID**: The unique identifier of the Azure AD instance under which your account and application are registered.

To get the tenant ID, follow these steps:

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Power BI.
4. From the `Overview` section, copy the `Directory (tenant) ID`.
{% /codeInfo %}

{% codeInfo srNumber=4 %}
- **Account Name**: The name of your ADLS account.

Here are the step-by-step instructions for finding the account name for an Azure Data Lake Storage account:

1. Sign in to the Azure portal and navigate to the `Storage accounts` page.
2. Find the Data Lake Storage account you want to access and click on its name.
3. In the account overview page, locate the `Account name` field. This is the unique identifier for the Data Lake Storage account.
4. You can use this account name to access and manage the resources associated with the account, such as creating and managing containers and directories.

{% /codeInfo %}

{% codeInfo srNumber=5 %}
- **Key Vault**: Azure Key Vault serves as a centralized secrets manager, securely storing and managing sensitive information, such as connection strings and cryptographic keys.

{% /codeInfo %}

{% partial file="/v1.4/connectors/yaml/storage/source-config-def.md" /%}

{% partial file="/v1.4/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.4/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=6 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: ADLS
  serviceName: local_adls
  serviceConnection:
    config:
      type: ADLS
      credentials:
```
```yaml {% srNumber=1 %}
        clientId: client-id
```
```yaml {% srNumber=2 %}
        clientSecret: client-secret
```
```yaml {% srNumber=3 %}
        tenantId: tenant-id
```
```yaml {% srNumber=4 %}
        accountName: account-name
```
```yaml {% srNumber=5 %}
        vaultName: vault-name
```
```yaml {% srNumber=6 %}
      # connectionOptions:
        # key: value
```
```yaml {% srNumber=7 %}
      # connectionArguments:
        # key: value
```

{% partial file="/v1.4/connectors/yaml/storage/source-config.md" /%}

{% partial file="/v1.4/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.4/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}



{% partial file="/v1.4/connectors/yaml/ingestion-cli.md" /%}

## Related

{% tilesContainer %}

{% tile
   icon="mediation"
   title="Configure Ingestion Externally"
   description="Deploy, configure, and manage the ingestion workflows externally."
   link="/deployment/ingestion"
 / %}

{% /tilesContainer %}
