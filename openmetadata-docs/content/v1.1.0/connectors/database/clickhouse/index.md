---
title: Clickhouse
slug: /connectors/database/clickhouse
---

# Clickhouse

{% multiTablesWrapper %}

| Feature            | Status                       |
| :----------------- | :--------------------------- |
| Stage              | PROD                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="check" /%} |
| Data Profiler      | {% icon iconName="check" /%} |
| Data Quality       | {% icon iconName="check" /%} |
| Lineage            | {% icon iconName="check" /%} |
| DBT                | {% icon iconName="check" /%} |
| Supported Versions | --                           |

| Feature      | Status                       |
| :----------- | :--------------------------- |
| Lineage      | {% icon iconName="check" /%} |
| Table-level  | {% icon iconName="check" /%} |
| Column-level | {% icon iconName="check" /%} |

{% /multiTablesWrapper %}

In this section, we provide guides and references to use the Clickhouse connector.

Configure and schedule Clickhouse metadata and profiler workflows from the OpenMetadata UI:

- [Clickhouse](#clickhouse)
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

{% partial file="/v1.1.0/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/clickhouse/yaml"} /%}

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
  file="/v1.1.0/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Clickhouse", 
    selectServicePath: "/images/v1.1.0/connectors/clickhouse/select-service.png",
    addNewServicePath: "/images/v1.1.0/connectors/clickhouse/add-new-service.png",
    serviceConnectionPath: "/images/v1.1.0/connectors/clickhouse/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

- **Username**: Specify the User to connect to Clickhouse. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Clickhouse.
- **Host and Port**: Enter the fully qualified hostname and port number for your Clickhouse deployment in the Host and Port field.

{% partial file="/v1.1.0/connectors/database/advanced-configuration.md" /%}

You can find the full list of accepted options [here](https://clickhouse-driver.readthedocs.io/en/latest/api.html#clickhouse_driver.connection.Connection).

- **Connecting to Clickhouse with SSL Certificate**: You will need to use the `clickhouse+native` connection scheme. Then in the `Connection Options` reference the following key with their value:
  - `verify`: `true`
  - `secure`: `true`
  - `keyfile`: `/path/to/key/file`

The `keyfile` needs to be accessible by the service running the ingestion. For example if you are running the ingestion in a docker container, your `keyfile` needs to be present in the container at the location specify as a value in the `Connection Options`. Additionally, your `keyfile` needs to be in the `.cert` or `.pem` format.

{% /extraContent %}

{% partial file="/v1.1.0/connectors/test-connection.md" /%}

{% partial file="/v1.1.0/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.1.0/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.1.0/connectors/troubleshooting.md" /%}

{% partial file="/v1.1.0/connectors/database/related.md" /%}
