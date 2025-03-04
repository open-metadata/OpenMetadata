---
title: Run the GCS Datalake Connector Externally
slug: /connectors/database/gcs-datalake/yaml
---

{% connectorDetailsHeader
name="GCS Datalake"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "Sample Data"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Owners", "dbt", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the GCS Datalake connector.

Configure and schedule GCS Datalake metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.6/connectors/external-ingestion-deployment.md" /%}

## Requirements

**Note:** GCS Datalake connector supports extracting metadata from file types `JSON`, `CSV`, `TSV` & `Parquet`.


### Python Requirements

{% partial file="/v1.6/connectors/python-requirements.md" /%}

If running OpenMetadata version greater than 0.13, you will need to install the Datalake ingestion for GCS

#### GCS installation

```bash
pip3 install "openmetadata-ingestion[datalake-gcp]"
```

#### If version <0.13

You will be installing the requirements for GCS

```bash
pip3 install "openmetadata-ingestion[datalake]"
```

## Metadata Ingestion
All connectors are defined as JSON Schemas. Here you can find the structure to create a connection to Datalake.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following JSON Schema.

## 1. Define the YAML Config

### This is a sample config for Datalake using GCS:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=5 %}

* **type**: Credentials type, e.g. `service_account`.
* **projectId**
* **privateKey**
* **privateKeyId**
* **clientEmail**
* **clientId**
* **authUri**: [https://accounts.google.com/o/oauth2/auth](https://accounts.google.com/o/oauth2/auth) by default
* **tokenUri**: [https://oauth2.googleapis.com/token](https://oauth2.googleapis.com/token) by default
* **authProviderX509CertUrl**: [https://www.googleapis.com/oauth2/v1/certs](https://www.googleapis.com/oauth2/v1/certs) by default
* **clientX509CertUrl**
* **bucketName**: name of the bucket in GCS
* **Prefix**: prefix in gcp bucket

{% /codeInfo %}


{% partial file="/v1.6/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.6/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.6/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: datalake
  serviceName: local_datalake
  serviceConnection:
    config:
      type: Datalake
      configSource:
        securityConfig:
```
```yaml {% srNumber=5 %}
          gcpConfig:
            type: type of account
            projectId: project id
            privateKeyId: private key id
            privateKey: private key
            clientEmail: client email
            clientId: client id
            authUri: https://accounts.google.com/o/oauth2/auth
            tokenUri: https://oauth2.googleapis.com/token
            authProviderX509CertUrl: https://www.googleapis.com/oauth2/v1/certs
            clientX509CertUrl:  clientX509 Certificate Url
      bucketName: bucket name
      prefix: prefix
```

{% partial file="/v1.6/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.6/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.6/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.6/connectors/yaml/ingestion-cli.md" /%}

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).
