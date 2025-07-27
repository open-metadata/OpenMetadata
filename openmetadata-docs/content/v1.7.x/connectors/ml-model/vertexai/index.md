---
title: Vertexai | Official Docs
description: Get started with vertexai. Setup instructions, features, and configuration details inside.
slug: /connectors/ml-model/vertexai
collate: true
---

{% connectorDetailsHeader
name="VertexAI"
stage="BETA"
platform="Collate"
availableFeatures=["ML Store", "ML Features", "Hyper parameters"]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the VertexAI connector.

Configure and schedule VertexAI metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Troubleshooting](/connectors/ml-model/vertexai/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/ml-model/vertexai/yaml"} /%}

## Requirements

### VertexAI API Permissions 

- Go to [Cloud VertexAI Library enable API](https://cloud.google.com/vertex-ai/docs/featurestore/setup)
- Select the `GCP Project ID`.
- Click on `Enable API` which will enable the data catalog api on the respective project.

### GCP Permissions

To execute metadata extraction workflow successfully the user or the service account should have enough access to fetch required data. Following table describes the minimum required permissions

{% multiTablesWrapper %}

| #    | GCP Permission                | Required For            |
| :--- | :---------------------------- | :---------------------- |
| 1    | aiplatform.models.get         | Metadata Ingestion      |
| 2    | aiplatform.models.list        | Metadata Ingestion      |


{% /multiTablesWrapper %}


## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "VertexAI", 
    selectServicePath: "/images/v1.7/connectors/vertexai/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/vertexai/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/vertexai/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

**GCP Credentials**: 
You can authenticate with your VertexAI instance using either `GCP Credentials Path` where you can specify the file path of the service account key or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can checkout [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.

**GCP Credentials Values**: Passing the raw credential values provided by VertexAI. This requires us to provide the following information, all provided by VertexAI:

- **Credentials type**: Credentials Type is the type of the account, for a service account the value of this field is `service_account`. To fetch this key, look for the value associated with the `type` key in the service account key file.
- **Project ID**: A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the `project_id` key in the service account key file. You can also pass multiple project id to ingest metadata from different VertexAI projects into one service.
- **Private Key ID**: This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the `private_key_id` key in the service account file.
- **Private Key**: This is the private key associated with the service account that is used to authenticate and authorize access to VertexAI. To fetch this key, look for the value associated with the `private_key` key in the service account file.
- **Client Email**: This is the email address associated with the service account. To fetch this key, look for the value associated with the `client_email` key in the service account key file.
- **Client ID**: This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key  file.
- **Auth URI**: This is the URI for the authorization server. To fetch this key, look for the value associated with the `auth_uri` key in the service account key file. The default value to Auth URI is https://accounts.google.com/o/oauth2/auth.
- **Token URI**: The Google Cloud Token URI is a specific endpoint used to obtain an OAuth 2.0 access token from the Google Cloud IAM service. This token allows you to authenticate and access various Google Cloud resources and APIs that require authorization. To fetch this key, look for the value associated with the `token_uri` key in the service account credentials file. Default Value to Token URI is https://oauth2.googleapis.com/token.
- **Authentication Provider X509 Certificate URL**: This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the `auth_provider_x509_cert_url` key in the service account key file. The Default value for Auth Provider X509Cert URL is https://www.googleapis.com/oauth2/v1/certs
- **Client X509Cert URL**: This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the `client_x509_cert_url` key in the service account key  file.

**GCP Credentials Path**: Passing a local file path that contains the credentials.


**Location**:
Location refers to the geographical region where your resources, such as datasets, models, and endpoints, are physically hosted.(e.g. `us-central1`, `europe-west4`)

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/ml-model/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
