---
title: Clickhouse
slug: /connectors/database/clickhouse
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
  - [Profiler \& Data Quality](#profiler-&-data-quality)
  - [Usage \& Lineage](#usage-&-lineage)
- [Metadata Ingestion](#metadata-ingestion)
    - [Service Name](#service-name)
    - [Connection Options](#connection-options)
    - [Metadata Ingestion Options](#metadata-ingestion-options)
- [Troubleshooting](#troubleshooting)
  - [Workflow Deployment Error](#workflow-deployment-error)
- [Related](#related)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/clickhouse/yaml"} /%}

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

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Clickhouse", 
    selectServicePath: "/images/v1.3/connectors/clickhouse/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/clickhouse/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/clickhouse/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

- **Username**: Specify the User to connect to Clickhouse. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Clickhouse.
- **Host and Port**: Enter the fully qualified hostname and port number for your Clickhouse deployment in the Host and Port field.
- **Use HTTPS Protocol**: Enable this flag when the when the Clickhouse instance is hosted via HTTPS protocol. This flag is useful when you are using `clickhouse+http` connection scheme.
- **Secure Connection**: Establish secure connection with ClickHouse. ClickHouse supports secure communication over SSL/TLS to protect data in transit, by checking this option, it establishes secure connection with ClickHouse. This flag is useful when you are using `clickhouse+native` connection scheme.
- **Key File**: The key file path is the location when ClickHouse looks for a file containing the private key needed for secure communication over SSL/TLS. By default, ClickHouse will look for the key file in the `/etc/clickhouse-server directory`, with the file name `server.key`. However, this can be customized in the ClickHouse configuration file (`config.xml`). This flag is useful when you are using `clickhouse+native` connection scheme and the secure connection flag is enabled.

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
