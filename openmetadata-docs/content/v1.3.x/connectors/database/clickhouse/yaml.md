---
title: Run the Clickhouse Connector Externally
slug: /connectors/database/clickhouse/yaml
---

{% connectorDetailsHeader
name="Clickhouse"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "dbt"]
unavailableFeatures=["Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Clickhouse connector.

Configure and schedule Clickhouse metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](#query-usage)
- [Lineage](#lineage)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements


Clickhouse user must grant `SELECT` privilege on `system.*` and schema/tables to fetch the metadata of tables and views.

* Create a new user
* More details https://clickhouse.com/docs/en/sql-reference/statements/create/user

```sql
CREATE USER <username> IDENTIFIED WITH sha256_password BY <password>
```

* Grant Permissions
* More details on permissions can be found here at https://clickhouse.com/docs/en/sql-reference/statements/grant

```sql
-- Grant SELECT and SHOW to that user
-- More details on permissions can be found here at https://clickhouse.com/docs/en/sql-reference/statements/grant
GRANT SELECT, SHOW ON system.* to <username>;
GRANT SELECT ON <schema_name>.* to <username>;
```

### Profiler & Data Quality
Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler) and data quality tests [here](https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality).

### Usage & Lineage
For the usage and lineage workflow, the user will need `SELECT` privilege. You can find more information on the usage workflow [here](https://docs.open-metadata.org/connectors/ingestion/workflows/usage) and the lineage workflow [here](https://docs.open-metadata.org/connectors/ingestion/workflows/lineage).

### Python Requirements

To run the Clickhouse ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[clickhouse]"
```

If you want to run the Usage Connector, you'll also need to install:

```bash
pip3 install "openmetadata-ingestion[clickhouse-usage]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickhouseConnection.json)
you can find the structure to create a connection to Clickhouse.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Clickhouse:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Clickhouse. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to Clickhouse.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: Enter the fully qualified hostname and port number for your Clickhouse deployment in the Host and Port field.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**databaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**duration**: The duration of a SQL connection in ClickHouse depends on the configuration of the connection and the workload being processed. Connections are kept open for as long as needed to complete a query, but they can also be closed based on duration set.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**scheme**: There are 2 types of schemes that the user can choose from.

- **clickhouse+http**: Uses ClickHouse's HTTP interface for communication. Widely supported, but slower than native.
- **clickhouse+native**: Uses the native ClickHouse TCP protocol for communication. Faster than http, but may require additional server-side configuration. Recommended for performance-critical applications.


{% /codeInfo %}

{% codeInfo srNumber=35 %}

**https**: Enable this flag when the when the Clickhouse instance is hosted via HTTPS protocol. This flag is useful when you are using `clickhouse+http` connection scheme.

{% /codeInfo %}


{% codeInfo srNumber=36 %}

**secure**: Establish secure connection with ClickHouse. ClickHouse supports secure communication over SSL/TLS to protect data in transit, by checking this option, it establishes secure connection with ClickHouse. This flag is useful when you are using `clickhouse+native` connection scheme.

{% /codeInfo %}

{% codeInfo srNumber=37 %}

**keyfile**: The key file path is the location when ClickHouse looks for a file containing the private key needed for secure communication over SSL/TLS. By default, ClickHouse will look for the key file in the `/etc/clickhouse-server directory`, with the file name `server.key`. However, this can be customized in the ClickHouse configuration file (`config.xml`). This flag is useful when you are using `clickhouse+native` connection scheme and the secure connection flag is enabled.

{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=7 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: clickhouse
  serviceName: local_clickhouse
  serviceConnection:
    config:
      type: Clickhouse
```
```yaml {% srNumber=1 %}
      username: <username>
```
```yaml {% srNumber=2 %}
      password: <password>
```
```yaml {% srNumber=3 %}
      hostPort: <hostPort>
```
```yaml {% srNumber=4 %}
      # databaseSchema: schema
```
```yaml {% srNumber=5 %}
      # duration: 3600
```
```yaml {% srNumber=6 %}
      # scheme: clickhouse+http (default), or clickhouse+native
```
```yaml {% srNumber=35 %}
      # https: false
```
```yaml {% srNumber=36 %}
      # secure: true
```
```yaml {% srNumber=37 %}
      # keyfile: /etc/clickhouse-server/server.key
```
```yaml {% srNumber=7 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=8 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.3/connectors/yaml/query-usage.md" variables={connector: "clickhouse"} /%}

{% partial file="/v1.3/connectors/yaml/lineage.md" variables={connector: "clickhouse"} /%}

{% partial file="/v1.3/connectors/yaml/data-profiler.md" variables={connector: "clickhouse"} /%}

{% partial file="/v1.3/connectors/yaml/data-quality.md" /%}

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).
