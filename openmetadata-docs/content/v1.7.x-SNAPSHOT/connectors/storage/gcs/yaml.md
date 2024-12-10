---
title: Run the GCS Connector Externally
slug: /connectors/storage/gcs/yaml
---

{% connectorDetailsHeader
name="GCS"
stage="PROD"
platform="Collate"
availableFeatures=["Metadata"]
unavailableFeatures=[]
/ %}

This page contains the setup guide and reference information for the GCS connector.

Configure and schedule GCS metadata workflows from the CLI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.6/connectors/external-ingestion-deployment.md" /%}

## Requirements

To run the GCS ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[datalake-gcs]"
```

{%inlineCallout icon="description" bold="OpenMetadata 1.0 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

We need the following permissions in GCP:

### GCS Permissions

For all the buckets that we want to ingest, we need to provide the following:
- `storage.buckets.get`
- `storage.buckets.list`
- `storage.objects.get`
- `storage.objects.list`

### OpenMetadata Manifest

In any other connector, extracting metadata happens automatically. In this case, we will be able to extract high-level
metadata from buckets, but in order to understand their internal structure we need users to provide an `openmetadata.json`
file at the bucket root.

`Supported File Formats: [ "csv",  "tsv", "avro", "parquet", "json", "json.gz", "json.zip" ]`

You can learn more about this [here](/connectors/storage). Keep reading for an example on the shape of the manifest file.

{% partial file="/v1.6/connectors/storage/manifest.md" /%}

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/storage/GCSConnection.json)
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

**gcpConfig:**

**1.** Passing the raw credential values provided by GCP. This requires us to provide the following information, all provided by GCP:

  - **type**: Credentials Type is the type of the account, for a service account the value of this field is `service_account`. To fetch this key, look for the value associated with the `type` key in the service account key file.
  - **projectId**: A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the `project_id` key in the service account key file. You can also pass multiple project id to ingest metadata from different GCP projects into one service.
  - **privateKeyId**: This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the `private_key_id` key in the service account file.
  - **privateKey**: This is the private key associated with the service account that is used to authenticate and authorize access to GCP. To fetch this key, look for the value associated with the `private_key` key in the service account file.
  - **clientEmail**: This is the email address associated with the service account. To fetch this key, look for the value associated with the `client_email` key in the service account key file.
  - **clientId**: This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key  file.
  - **authUri**: This is the URI for the authorization server. To fetch this key, look for the value associated with the `auth_uri` key in the service account key file. The default value to Auth URI is https://accounts.google.com/o/oauth2/auth.
  - **tokenUri**: The Google Cloud Token URI is a specific endpoint used to obtain an OAuth 2.0 access token from the Google Cloud IAM service. This token allows you to authenticate and access various Google Cloud resources and APIs that require authorization. To fetch this key, look for the value associated with the `token_uri` key in the service account credentials file. Default Value to Token URI is https://oauth2.googleapis.com/token.
  - **authProviderX509CertUrl**: This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the `auth_provider_x509_cert_url` key in the service account key file. The Default value for Auth Provider X509Cert URL is https://www.googleapis.com/oauth2/v1/certs
  - **clientX509CertUrl**: This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the `client_x509_cert_url` key in the service account key  file.

**2.**  Passing a local file path that contains the credentials:
  - **gcpCredentialsPath**

- If you prefer to pass the credentials file, you can do so as follows:
```yaml
source:
  type: gcs
  serviceName: local_gcs
  serviceConnection:
    config:
      type: GCS
      credentials:
        gcpConfig: 
        path: <path to file>
```

- If you want to use [ADC authentication](https://cloud.google.com/docs/authentication#adc) for GCP you can just leave
the GCP credentials empty. This is why they are not marked as required.

```yaml
...
source:
  type: gcs
  serviceName: local_gcs
  serviceConnection:
    config:
      type: GCS
    credentials:
      gcpConfig: {}
...
```

{% /codeInfo %}

{% partial file="/v1.6/connectors/yaml/storage/source-config-def.md" /%}

{% partial file="/v1.6/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.6/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=2 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to storage service during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to storage service during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: gcs
  serviceName: "<service name>"
  serviceConnection:
    config:
      type: GCS
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
          clientId: "1234"
          # authUri: https://accounts.google.com/o/oauth2/auth (default)
          # tokenUri: https://oauth2.googleapis.com/token (default)
          # authProviderX509CertUrl: https://www.googleapis.com/oauth2/v1/certs (default)
          clientX509CertUrl: https://cert.url
      # taxonomyLocation: us
      # taxonomyProjectID: ["project-id-1", "project-id-2"]
      # usageLocation: us
```
```yaml {% srNumber=2 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=3 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.6/connectors/yaml/storage/source-config.md" /%}

{% partial file="/v1.6/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.6/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}
