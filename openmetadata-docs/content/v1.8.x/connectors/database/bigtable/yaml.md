---
title: Run the BigQuery Connector Externally
description: Learn how to configure OpenMetadata's Bigtable database connector using YAML. Complete setup guide with examples, parameters, and best practices.
slug: /connectors/database/bigtable/yaml
---

{% connectorDetailsHeader
name="BigTable"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "Owners", "dbt", "Tags", "Stored Procedures", "Sample Data", "Auto-Classification"]
/ %}

In this section, we provide guides and references to use the BigTable connector.

Configure and schedule BigTable metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the BigTable ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[bigtable]"
```

### GCP Permissions

To execute metadata extraction and usage workflow successfully the user or the service account should have enough access to fetch required data. Following table describes the minimum required permissions

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

### 1. Define the YAML Config

This is a sample config for BigTable:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**credentials**: 
You can authenticate with your bigtable instance using either `GCP Credentials Path` where you can specify the file path of the service account key or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can checkout [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.

**gcpConfig:**

**1.** Passing the raw credential values provided by BigTable. This requires us to provide the following information, all provided by BigTable:

**2.**  Passing a local file path that contains the credentials:
  - **gcpCredentialsPath**

{% /codeInfo %}

{% partial file="/v1.8/connectors/yaml/common/gcp-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=2 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: bigtable
  serviceName: "<service name>"
  serviceConnection:
    config:
      type: BigTable
```
```yaml {% srNumber=1 %}
      credentials:
        gcpConfig:
```

{% partial file="/v1.8/connectors/yaml/common/gcp-config.md" /%}

```yaml {% srNumber=2 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=3 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.8/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}
