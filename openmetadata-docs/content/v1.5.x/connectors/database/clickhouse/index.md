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

{% partial file="/v1.5/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/clickhouse/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/clickhouse/connections) user credentials with the Clickhouse connector.

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
Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](/how-to-guides/data-quality-observability/quality).

### Usage & Lineage
For the usage and lineage workflow, the user will need `SELECT` privilege. You can find more information on the usage workflow [here](/connectors/ingestion/workflows/usage) and the lineage workflow [here](/connectors/ingestion/workflows/lineage).

## Metadata Ingestion

{% partial 
  file="/v1.5/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Clickhouse", 
    selectServicePath: "/images/v1.5/connectors/clickhouse/select-service.png",
    addNewServicePath: "/images/v1.5/connectors/clickhouse/add-new-service.png",
    serviceConnectionPath: "/images/v1.5/connectors/clickhouse/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.5/connectors/test-connection.md" /%}

{% partial file="/v1.5/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.5/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.5/connectors/troubleshooting.md" /%}

{% partial file="/v1.5/connectors/database/related.md" /%}
