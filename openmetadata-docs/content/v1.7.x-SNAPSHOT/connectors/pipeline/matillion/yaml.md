---
title: Run the Matillion Connector Externally
slug: /connectors/pipeline/matillion/yaml
collate: true
---

{% connectorDetailsHeader
name="Matillion"
stage="PROD"
platform="Collate"
availableFeatures=["Pipelines", "Lineage"]
unavailableFeatures=["Owners", "Tags", "Pipeline Status"]
/ %}



In this section, we provide guides and references to use the Matillion connector.

Configure and schedule Matillion metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/matillion/yaml"} /%}

## Requirements

To extract metadata from Matillion, you need to create a user with the following permissions:

- `API` Permission ( While Creating the User, from Admin -> User )


### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the Matillion ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[matillion]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/matillionConnection.json)
you can find the structure to create a connection to Matillion.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Matillion:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: The hostname or IP address with the REST API enabled eg.`https://<your-matillion-host-name-here>`

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**username**: The username to authenticate with the Matillion instance.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**password**: The password to authenticate with the Matillion instance.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**caCertificate** : CA Certificate to authenticate with the Matillion instance.

{% /codeInfo %}


{% partial file="/v1.7/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml {% isCodeBlock=true %}
source:
  type: matillion
  serviceName: matillion_service
  serviceConnection:
    config:
      type: Matillion
```
```yaml {% srNumber=1 %}
        hostPort: "https://<your-matillion-here>"
```
```yaml {% srNumber=2 %}
        username: "username"
```
```yaml {% srNumber=3 %}
        password: "password"
```

```yaml {% srNumber=3 %}
        sslConfig:
                caCertificate: |
                        -----BEGIN CERTIFICATE-----
                        sample caCertificateData  
                        -----END CERTIFICATE-----
```

{% partial file="/v1.7/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}
