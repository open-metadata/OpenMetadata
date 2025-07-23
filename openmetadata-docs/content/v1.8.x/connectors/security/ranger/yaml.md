---
title: Run the Apache Ranger Connector Externally
description: Use YAML to configure Apache Ranger ingestion and enable security policy metadata extraction and reverse metadata tracking.
slug: /connectors/security/ranger/yaml
---

{% connectorDetailsHeader
name="Apache Ranger"
stage="Beta"
platform="OpenMetadata"
availableFeatures=["Reverse Metadata (Collate Only)"]
unavailableFeatures=["Metadata", "Usage", "Data Profiler", "Data Quality", "Lineage"]
/ %}

In this section, we provide guides and references to use the Apache Ranger connector.

Configure and schedule Apache Ranger metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

We extract Apache Ranger's metadata by using its [Admin REST API](https://ranger.apache.org/apidocs/index.html). To run this ingestion, you need a user with appropriate permissions to access the Ranger Admin API.

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the Apache Ranger ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[ranger]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/security/rangerConnection.json)
you can find the structure to create a connection to Apache Ranger.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Apache Ranger:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: Apache Ranger Admin URL. This should be the complete URL including protocol (http/https) and port. For example, you might set it to `https://localhost:6080`.

{% /codeInfo %}

{% codeInfo srNumber=2 %}
**Basic Authentication**

- **username**: Username to connect to Apache Ranger. This user should have privileges to read all policies and metadata in Ranger.
- **password**: Password to connect to Apache Ranger.

{% /codeInfo %}

{% codeInfo srNumber=3 %}
**Kerberos Authentication**

- **keytabPath**: Path to the keytab file for Kerberos authentication. The keytab file should be accessible from the OpenMetadata server.
- **principal**: Kerberos principal for authentication. Used with keytab file (e.g., `ranger@EXAMPLE.COM`).

{% /codeInfo %}

{% partial file="/v1.8/connectors/yaml/security/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: ranger
  serviceName: ranger_source
  serviceConnection:
    config:
      type: Ranger
```
```yaml {% srNumber=1 %}
      hostPort: https://localhost:6080
```
```yaml {% srNumber=2 %}
      authType:
        username: admin
        password: admin123
```
```yaml {% srNumber=3 %}
        # For Kerberos Authentication:
        # keytabPath: /path/to/keytab
        # principal: ranger@EXAMPLE.COM
```

{% partial file="/v1.8/connectors/yaml/security/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

### 2. Prepare the Security Service configuration

#### Example for Basic Authentication:

```yaml
source:
  type: ranger
  serviceName: local_ranger
  serviceConnection:
    config:
      type: Ranger
      hostPort: https://localhost:6080
      authType:
        username: admin
        password: admin123
  sourceConfig:
    config:
      type: SecurityMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  loggerLevel: INFO
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

#### Example for Kerberos Authentication:

```yaml
source:
  type: ranger
  serviceName: kerb_ranger
  serviceConnection:
    config:
      type: Ranger
      hostPort: https://ranger-admin.example.com:6080
      authType:
        keytabPath: /path/to/ranger.keytab
        principal: ranger@EXAMPLE.COM
  sourceConfig:
    config:
      type: SecurityMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  loggerLevel: INFO
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%} 