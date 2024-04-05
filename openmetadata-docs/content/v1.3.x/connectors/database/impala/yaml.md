---
title: Run the Impala Connector Externally
slug: /connectors/database/impala/yaml
---

{% connectorDetailsHeader
name="Impala"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt"]
unavailableFeatures=["Query Usage", "Owners", "Lineage", "Column-level Lineage", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Impala connector.

Configure and schedule Impala metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

To run the Impala ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[impala]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/impalaConnection.json)
you can find the structure to create a connection to Impala.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Hive:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Impala. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: User password.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**authOptions**: Enter the auth options string.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**authMechanism**: `PLAIN`, `NOSASL`, `GSSAPI`, `LDAP` or `JWT`

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**hostPort**: Enter the fully qualified hostname and port number for your Hive deployment in the Host and Port field.

{% /codeInfo %}

#### Source Configuration - Source Config

{% codeInfo srNumber=8 %}

{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=6 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: impala
  serviceName: local_impala
  serviceConnection:
    config:
      type: Impala
```
```yaml {% srNumber=1 %}
      username: <username>
```
```yaml {% srNumber=2 %}
      password: <password>
```
```yaml {% srNumber=3 %}
      authOptions: <auth options>
```
```yaml {% srNumber=4 %}
      authMechanism: PLAIN # NOSASL, PLAIN, GSSAPI, LDAP, JWT
```
```yaml {% srNumber=5 %}
      hostPort: <hive connection host & port>
```
```yaml {% srNumber=6 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=7 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.3/connectors/yaml/data-profiler.md" variables={connector: "impala"} /%}

{% partial file="/v1.3/connectors/yaml/data-quality.md" /%}

## dbt Integration

{% tilesContainer %}

{% tile
icon="mediation"
title="dbt Integration"
description="Learn more about how to ingest dbt models' definitions and their lineage."
link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
