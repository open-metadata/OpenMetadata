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

{% partial file="/v1.9/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.9/connectors/python-requirements.md" /%}

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

{% /codeInfo %}

{% partial file="/v1.9/connectors/yaml/common/gcp-config.md" /%}

{% codeInfo srNumber=4 %}

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
```

{% partial file="/v1.9/connectors/yaml/common/gcp-config.md" /%}

```yaml {% srNumber=4 %}
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

{% partial file="/v1.9/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.9/connectors/yaml/ingestion-cli.md" /%}
