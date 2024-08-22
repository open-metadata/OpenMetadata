---
title: BigTable
slug: /connectors/database/bigtable
---

{% connectorDetailsHeader
name="BigTable"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "Owners", "dbt", "Tags", "Stored Procedures"]
/ %}


In this section, we provide guides and references to use the BigTable connector.

Configure and schedule BigTable metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/bigtable/yaml"} /%}

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

{%inlineCallout icon="description" bold="OpenMetadata 1.3.1 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

## Requirements

### BigTable Admin API Permissions 

- Go to [Cloud Bigtable Admin API in the GCP API Library](https://console.cloud.google.com/apis/library/bigtableadmin.googleapis.com)
- Select the `GCP Project ID`.
- Click on `Enable API` which will enable the data catalog api on the respective project.

### BigTable API Permissions 

- Go to [Cloud Bigtable API in the GCP API Library](https://console.cloud.google.com/apis/library/bigtable.googleapis.com)
- Select the `GCP Project ID`.
- Click on `Enable API` which will enable the data catalog api on the respective project.

### GCP Permissions

To execute metadata extraction workflow successfully the user or the service account should have enough access to fetch required data. Following table describes the minimum required permissions

{% multiTablesWrapper %}

| #    | GCP Permission                | Required For            |
| :--- | :---------------------------- | :---------------------- |
| 1    | bigtable.instances.get        | Metadata Ingestion      |
| 2    | bigtable.instances.list       | Metadata Ingestion      |
| 3    | bigtable.tables.get           | Metadata Ingestion      |
| 4    | bigtable.tables.list          | Metadata Ingestion      |
| 5    | bigtable.tables.readRows      | Metadata Ingestion      |

{% /multiTablesWrapper %}

{% tilesContainer %}
{% tile
icon="manage_accounts"
title="Create Custom GCP Role"
description="Checkout this documentation on how to create a custom role and assign it to the service account."
link="/connectors/database/bigtable/roles"
  / %}
{% /tilesContainer %}

## Metadata Ingestion

{% partial
  file="/v1.3/connectors/metadata-ingestion-ui.md"
  variables={
    connector: "BigTable",
    selectServicePath: "/images/v1.3/connectors/bigtable/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/bigtable/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/bigtable/service-connection.png",
  }
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

**GCP Credentials**: 
You can authenticate with your BigTable instance using either `GCP Credentials Path` where you can specify the file path of the service account key or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can checkout [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.

**GCP Credentials Values**: Passing the raw credential values provided by BigTable. This requires us to provide the following information, all provided by BigTable:

- **Credentials type**: Credentials Type is the type of the account, for a service account the value of this field is `service_account`. To fetch this key, look for the value associated with the `type` key in the service account key file.
- **Project ID**: A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the `project_id` key in the service account key file. You can also pass multiple project id to ingest metadata from different BigTable projects into one service.
- **Private Key ID**: This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the `private_key_id` key in the service account file.
- **Private Key**: This is the private key associated with the service account that is used to authenticate and authorize access to BigTable. To fetch this key, look for the value associated with the `private_key` key in the service account file.
- **Client Email**: This is the email address associated with the service account. To fetch this key, look for the value associated with the `client_email` key in the service account key file.
- **Client ID**: This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key  file.
- **Auth URI**: This is the URI for the authorization server. To fetch this key, look for the value associated with the `auth_uri` key in the service account key file. The default value to Auth URI is https://accounts.google.com/o/oauth2/auth.
- **Token URI**: The Google Cloud Token URI is a specific endpoint used to obtain an OAuth 2.0 access token from the Google Cloud IAM service. This token allows you to authenticate and access various Google Cloud resources and APIs that require authorization. To fetch this key, look for the value associated with the `token_uri` key in the service account credentials file. Default Value to Token URI is https://oauth2.googleapis.com/token.
- **Authentication Provider X509 Certificate URL**: This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the `auth_provider_x509_cert_url` key in the service account key file. The Default value for Auth Provider X509Cert URL is https://www.googleapis.com/oauth2/v1/certs
- **Client X509Cert URL**: This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the `client_x509_cert_url` key in the service account key  file.

**GCP Credentials Path**: Passing a local file path that contains the credentials.

{% note %}
If you want to use [ADC authentication](https://cloud.google.com/docs/authentication#adc) for BigTable you can just leave
the GCP credentials empty. This is why they are not marked as required.
{% /note %}


{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
