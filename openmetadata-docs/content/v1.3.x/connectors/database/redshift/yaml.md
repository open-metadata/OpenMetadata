---
title: Run the Redshift Connector Externally
slug: /connectors/database/redshift/yaml
---

{% connectorDetailsHeader
name="Redshift"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Stored Procedures"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Redshift connector.

Configure and schedule Redshift metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](#query-usage)
- [Lineage](#lineage)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

Redshift user must grant `SELECT` privilege on table [SVV_TABLE_INFO](https://docs.aws.amazon.com/redshift/latest/dg/r_SVV_TABLE_INFO.html) to fetch the metadata of tables and views. For more information visit [here](https://docs.aws.amazon.com/redshift/latest/dg/c_visibility-of-data.html).

```sql

CREATE USER test_user with PASSWORD 'password';
GRANT SELECT ON TABLE svv_table_info to test_user;

```

### Python Requirements

To run the Redshift ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[redshift]"
```

If you want to run the Usage Connector, you'll also need to install:

```bash
pip3 install "openmetadata-ingestion[redshift-usage]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/redshiftConnection.json)
you can find the structure to create a connection to Redshift.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)


**Note:** During the metadata ingestion for redshift, the tables in which the distribution style i.e `DISTSTYLE` is not `AUTO` will be marked as partitioned tables


### 1. Define the YAML Config

This is a sample config for Redshift:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Snoflake. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to Redshift.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**database**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**hostPort**: Host and port of the Redshift service.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**ingestAllDatabases**: Ingest data from all databases in Redshift. You can use databaseFilterPattern on top of this.

{% /codeInfo %}



{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=6 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: redshift
  serviceName: aws_redshift
  serviceConnection:
    config:
      type: Redshift
```
```yaml {% srNumber=1 %}
      username: username
```
```yaml {% srNumber=2 %}
      password: password
```
```yaml {% srNumber=3 %}
      database: dev
```
```yaml {% srNumber=4 %}
      hostPort: cluster.name.region.redshift.amazonaws.com:5439
```
```yaml {% srNumber=5 %}
      # ingestAllDatabases: true
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


{% partial file="/v1.3/connectors/yaml/query-usage.md" variables={connector: "redshift"} /%}

{% partial file="/v1.3/connectors/yaml/lineage.md" variables={connector: "redshift"} /%}

{% partial file="/v1.3/connectors/yaml/data-profiler.md" variables={connector: "redshift"} /%}

{% partial file="/v1.3/connectors/yaml/data-quality.md" /%}

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).



