---
title: Run Data Insights using Metadata CLI
slug: /how-to-guides/data-insights/metadata-cli
---

# Run Data Insights using Metadata CLI

## 1. Define the YAML Config

This is a sample config for Data Insights:

```yaml
source:
  type: dataInsight
  serviceName: OpenMetadata
  sourceConfig:
    config:
      type: MetadataToElasticSearch
processor:
  type: data-insight-processor
  config: {}
sink:
  type: elasticsearch
  config:
    es_host: localhost
    es_port: 9200
    recreate_indexes: false
workflowConfig:
  loggerLevel: DEBUG
  openMetadataServerConfig:
    hostPort: '<OpenMetadata host and port>'
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```

### Source Configuration - Source Config

- To send the metadata to OpenMetadata, it needs to be specified as `type: MetadataToElasticSearch`.

### Processor Configuration

- To send the metadata to OpenMetadata, it needs to be specified as `type: data-insight-processor`.

### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).
You can find the different implementation of the ingestion below.

## 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```bash
metadata insight -c <path-to-yaml>
```
