---
title: Run the Exasol Connector Externally
slug: /connectors/database/exasol/yaml
---

{% connectorDetailsHeader
name="Exasol"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "Owners", "dbt", "Tags", "Stored Procedures", "Sample Data"]
/ %}

In this section, we provide guides and references to use the Exasol connector.

Configure and schedule Exasol metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.9/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.9/connectors/python-requirements.md" /%}

To run the Exasol ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[Exasol]"
```

## Metadata Ingestion

### 1. Define the YAML Config

This is a sample config for Exasol:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**`username`** 
The username required to authenticate and connect to the Exasol database. The user must have sufficient privileges to access and read all the metadata available in Exasol.

**`password`**
The password associated with the user account used to connect to the Exasol database. Ensure this password corresponds to the specified username and is stored securely. Avoid sharing passwords in plain text and use secure methods for managing sensitive credentials.

**`hostPort`**
Provide the fully qualified hostname and port number of your Exasol deployment in the "Host and Port" field.

**`SSL/TLS Settings`** 
Mode/setting for SSL validation:

- **`validate-certificate`**: Uses Transport Layer Security (TLS) and validates the server certificate using system certificate stores.

- **`ignore-certificate`**: Uses Transport Layer Security (TLS) but disables the validation of the server certificate. This should not be used in production. It can be useful during testing with self-signed certificates.

- **`disable-tls`**: Does not use any Transport Layer Security (TLS). Data will be sent in plain text (no encryption).
While this may be helpful in rare cases of debugging, make sure you do not use this in production.

{% /codeInfo %}

#### Advanced Configuration

{% codeInfo srNumber=2 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: exasol
  serviceName: "<service name>"
  serviceConnection:
    config:
      type: Exasol
```
```yaml {% srNumber=1 %}
          username: Exasol
          password: password
          hostPort: 127.0.0.1:8563
          SSL/TLS Settings: validate-certificate (default), or ignore-certificate, or disable-tls
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
