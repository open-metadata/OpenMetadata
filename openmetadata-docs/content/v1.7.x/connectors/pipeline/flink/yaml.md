---
title: Run the Flink Connector Externally
slug: /connectors/pipeline/flink/yaml
---

{% connectorDetailsHeader
name="Flink"
stage="BETA"
platform="Collate"
availableFeatures=["Pipelines", "Pipeline Status", "Usage"]
unavailableFeatures=["Owners", "Lineage", "Tags"]
/ %}


In this section, we provide guides and references to use the Flink connector.

Configure and schedule Flink metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the Flink ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[flink]"
```

## Metadata Ingestion

### 1. Define the YAML Config

This is a sample config for Flink:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: The hostname or IP address of the Flink Connect worker with the REST API enabled

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**verifySSL**: Whether SSL verification should be perform when authenticating.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**Flink Connect Config**: OpenMetadata supports SSL config or no Authentication.

*1. SSL config
    - caCertificate: Authorized certificate for ssl configured server.
    - sslCertificate: SSL certificate for the server.
    - sslKey: Server root key for the connection.
{% /codeInfo %}


{% partial file="/v1.7/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml {% isCodeBlock=true %}
source:
  type: flink
  serviceName: flink_pipeline_dashboard
  serviceConnection:
    config:
      type: Flink
```
```yaml {% srNumber=1 %}
        hostPort: "https://<yourflinkhostport>" # or http://localhost:8083 or http://127.0.0.1:8083
```
```yaml {% srNumber=2 %}
        verifySSL: no-ssl
```
```yaml {% srNumber=3 %}
        sslConfig:
                caCertificate: |
                        -----BEGIN CERTIFICATE-----
                        sample certificate
                        -----END CERTIFICATE-----
                sslCertificate: |
                        -----BEGIN CERTIFICATE-----
                        sample certificate
                        -----END CERTIFICATE-----
                sslKey: |
                        -----BEGIN PRIVATE KEY-----
                        sample certificate
                        -----END PRIVATE KEY-----
```

{% partial file="/v1.7/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}
