---
title: Run the VertexAI Connector Externally
slug: /connectors/ml-model/vertexai/yaml
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

Configure and schedule VertexAI metadata from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.6/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.6/connectors/python-requirements.md" /%}

To run the VertexAI ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[vertexai]"
```

### GCP Permissions

To execute metadata extraction workflow successfully the user or the service account should have enough access to fetch required data. Following table describes the minimum required permissions

{% multiTablesWrapper %}

| #    | GCP Permission                | Required For            |
| :--- | :---------------------------- | :---------------------- |
| 1    | aiplatform.models.get         | Metadata Ingestion      |
| 2    | aiplatform.models.list        | Metadata Ingestion      |


{% /multiTablesWrapper %}


## Metadata Ingestion

### 1. Define the YAML Config

This is a sample config for VertexAI:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**credentials**: 
You can authenticate with your vertexai instance using either `GCP Credentials Path` where you can specify the file path of the service account key or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can checkout [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.

**gcpConfig:**

**1.** Passing the raw credential values provided by VertexAI. This requires us to provide the following information, all provided by VertexAI:

  - **type**: Credentials Type is the type of the account, for a service account the value of this field is `service_account`. To fetch this key, look for the value associated with the `type` key in the service account key file.
  - **projectId**: A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the `project_id` key in the service account key file. You can also pass multiple project id to ingest metadata from different VertexAI projects into one service.
  - **privateKeyId**: This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the `private_key_id` key in the service account file.
  - **privateKey**: This is the private key associated with the service account that is used to authenticate and authorize access to VertexAI. To fetch this key, look for the value associated with the `private_key` key in the service account file.
  - **clientEmail**: This is the email address associated with the service account. To fetch this key, look for the value associated with the `client_email` key in the service account key file.
  - **clientId**: This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key  file.
  - **authUri**: This is the URI for the authorization server. To fetch this key, look for the value associated with the `auth_uri` key in the service account key file. The default value to Auth URI is https://accounts.google.com/o/oauth2/auth.
  - **tokenUri**: The Google Cloud Token URI is a specific endpoint used to obtain an OAuth 2.0 access token from the Google Cloud IAM service. This token allows you to authenticate and access various Google Cloud resources and APIs that require authorization. To fetch this key, look for the value associated with the `token_uri` key in the service account credentials file. Default Value to Token URI is https://oauth2.googleapis.com/token.
  - **authProviderX509CertUrl**: This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the `auth_provider_x509_cert_url` key in the service account key file. The Default value for Auth Provider X509Cert URL is https://www.googleapis.com/oauth2/v1/certs
  - **clientX509CertUrl**: This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the `client_x509_cert_url` key in the service account key  file.

**2.**  Passing a local file path that contains the credentials:
  - **gcpCredentialsPath**

**Location**:
Location refers to the geographical region where your resources, such as datasets, models, and endpoints, are physically hosted.(e.g. `us-central1`, `europe-west4`)

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: vertexai
  serviceName: localvx
  serviceConnection:
    config:
        type: VertexAI
```
```yaml {% srNumber=1 %}
        credentials:
            gcpConfig:
            type: My Type
            projectId: project ID # ["project-id-1", "project-id-2"]
            privateKeyId: us-east-2
            privateKey: |
                -----BEGIN PRIVATE KEY-----
                Super secret key
                -----END PRIVATE KEY-----
            clientEmail: client@mail.com
            clientId: 1234
            # authUri: https://accounts.google.com/o/oauth2/auth (default)
            # tokenUri: https://oauth2.googleapis.com/token (default)
            # authProviderX509CertUrl: https://www.googleapis.com/oauth2/v1/certs (default)
            clientX509CertUrl: https://cert.url
        location: PROJECT LOCATION/REGION (us-central1)

```
```yaml {% srNumber=2 %}
        # connectionOptions:
        #   key: value
```
```yaml {% srNumber=3 %}
        # connectionArguments:
        #   key: value
```

{% partial file="/v1.6/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.6/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.6/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.6/connectors/yaml/ingestion-cli.md" /%}
