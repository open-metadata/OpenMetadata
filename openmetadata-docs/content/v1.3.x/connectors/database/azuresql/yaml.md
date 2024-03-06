---
title: Run the AzureSQL Connector Externally
slug: /connectors/database/azuresql/yaml
---

{% connectorDetailsHeader
name="AzureSQL"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "dbt"]
unavailableFeatures=["Stored Procedures", "Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the AzureSQL connector.

Configure and schedule AzureSQL metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

Make sure if you have whitelisted ingestion container IP on Azure SQL firewall rules. Checkout [this](https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure?view=azuresql#use-the-azure-portal-to-manage-server-level-ip-firewall-rules) document on how to whitelist your IP using azure portal.

AzureSQL database user must grant `SELECT` privilege to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql?view=sql-server-ver16
CREATE USER Mary WITH PASSWORD = '********';
-- Grant SELECT on table
GRANT SELECT TO Mary;
```

### Python Requirements

To run the AzureSQL ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[azuresql]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/azureSQLConnection.json)
you can find the structure to create a connection to AzureSQL.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for AzureSQL:

{% codePreview %}

{% codeInfoContainer %}
#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to AzureSQL. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to AzureSQL.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: Enter the fully qualified hostname and port number for your AzureSQL deployment in the Host and Port field.

{% /codeInfo %}


{% codeInfo srNumber=4 %}

**database**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.

{% /codeInfo %}


{% codeInfo srNumber=5 %}

**driver**: Connecting to AzureSQL requires ODBC driver to be installed. Specify ODBC driver name in the field.
You can download the ODBC driver from [here](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16).In case of docker or kubernetes deployment this driver comes out of the box with version  `ODBC Driver 18 for SQL Server`.

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
  type: azuresql
  serviceName: local_azuresql
  serviceConnection:
    config:
      type: AzureSQL
```
```yaml {% srNumber=1 %}
      username: username
```
```yaml {% srNumber=2 %}
      password: password
```
```yaml {% srNumber=3 %}
      hostPort: hostPort
```
```yaml {% srNumber=4 %}
      # database: database_name
```
```yaml {% srNumber=5 %}
      # driver: ODBC Driver 18 for SQL Server (default)
```
```yaml {% srNumber=6 %}
      connectionOptions:
        key: value
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

{% partial file="/v1.3/connectors/yaml/data-profiler.md" variables={connector: "azuresql"} /%}

{% partial file="/v1.3/connectors/yaml/data-quality.md" /%}

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}

## Related

{% tilesContainer %}

{% tile
   icon="mediation"
   title="Configure Ingestion Externally"
   description="Deploy, configure, and manage the ingestion workflows externally."
   link="/deployment/ingestion"
 / %}

{% /tilesContainer %}
