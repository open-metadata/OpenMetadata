---
title: Run the Unity Catalog Connector Externally
description: Configure Unity Catalog database connector with OpenMetadata using YAML. Step-by-step setup guide, configuration examples, and best practices included.
slug: /connectors/database/unity-catalog/yaml
---

{% connectorDetailsHeader
name="Unity Catalog"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Sample Data", "Reverse Metadata (Collate Only)", "Owners", "Tags", "Auto-Classification"]
unavailableFeatures=["Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Unity Catalog connector.

Configure and schedule Unity Catalog metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](#query-usage)
- [Lineage](#lineage)
- [dbt Integration](#dbt-integration)
{% collateContent %}
- [Reverse Metadata](/connectors/ingestion/workflows/reverse-metadata)
{% /collateContent %}

{% partial file="/v1.9/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.9/connectors/python-requirements.md" /%}

To run the Unity Catalog ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[databricks]"
```
### Permission Requirement

To enable full functionality of metadata extraction, profiling, usage, and lineage features in OpenMetadata, the following permissions must be granted to the relevant users in your Databricks environment.

### Metadata and Profiling Permissions

These permissions are required on the catalogs, schemas, and tables from which metadata and profiling information will be ingested.

```sql
GRANT USE CATALOG ON CATALOG <catalog_name> TO `<user>`;
GRANT USE SCHEMA ON SCHEMA <schema_name> TO `<user>`;
GRANT SELECT ON TABLE <table_name> TO `<user>`;
```

Ensure these grants are applied to all relevant tables for metadata ingestion and profiling operations.

### Usage and Lineage

These permissions enable OpenMetadata to extract query history and construct lineage information.

```sql
GRANT SELECT ON SYSTEM.QUERY.HISTORY TO `<user>`;
GRANT USE SCHEMA ON SCHEMA system.query TO `<user>`;
```

These permissions allow access to Databricks system tables that track query activity, enabling lineage and usage statistics generation.

{% note %}

Adjust <user>, <catalog_name>, <schema_name>, and <table_name> according to your specific deployment and security requirements.

{% /note %}

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/databricksConnection.json)
you can find the structure to create a connection to Databricks.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Unity Catalog:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**catalog**: Catalog of the data source(Example: hive_metastore). This is optional parameter, if you would like to restrict the metadata reading to a single catalog. When left blank, OpenMetadata Ingestion attempts to scan all the catalog.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**databaseSchema**: DatabaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: Enter the fully qualified hostname and port number for your Databricks deployment in the Host and Port field.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**token**: Generated Token to connect to Databricks.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**httpPath**: Databricks compute resources URL.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**connectionTimeout**: The maximum amount of time (in seconds) to wait for a successful connection to the data source. If the connection attempt takes longer than this timeout period, an error will be returned.

{% /codeInfo %}


{% partial file="/v1.9/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=7 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: unitycatalog
  serviceName: local_unitycatalog
  serviceConnection:
    config:
      type: UnityCatalog
```
```yaml {% srNumber=1 %}
      catalog: hive_metastore
```
```yaml {% srNumber=2 %}
      databaseSchema: default
```
```yaml {% srNumber=3 %}
      token: <databricks token>
```
```yaml {% srNumber=4 %}
      hostPort: <databricks connection host & port>
```
```yaml {% srNumber=5 %}
      httpPath: <http path of databricks cluster>
```
```yaml {% srNumber=6 %}
      connectionTimeout: 120
```
```yaml {% srNumber=7 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=8 %}
      # connectionArguments:
      #   key: value
```


{% partial file="/v1.9/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.9/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.9/connectors/yaml/query-usage.md" variables={connector: "unitycatalog"} /%}

{% partial file="/v1.9/connectors/yaml/lineage.md" variables={connector: "unitycatalog"} /%}

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).
