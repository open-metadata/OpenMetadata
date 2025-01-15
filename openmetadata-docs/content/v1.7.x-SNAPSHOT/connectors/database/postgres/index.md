---
title: Postgres
slug: /connectors/database/postgres
---

{% connectorDetailsHeader
name="Postgres"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Owners", "Tags"]
unavailableFeatures=["Stored Procedures"]
/ %}

In this section, we provide guides and references to use the PostgreSQL connector.

Configure and schedule PostgreSQL metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](/connectors/ingestion/workflows/usage)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Enable Security](#securing-postgres-connection-with-ssl-in-openmetadata)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/postgres/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/postgres/connections) user credentials with the Postgres connector.

## Requirements

{% note %}
Note that we only support officially supported Postgres versions. You can check the version list [here](https://www.postgresql.org/support/versioning/).
{% /note %}

### Usage and Lineage considerations

When extracting lineage and usage information from Postgres we base our finding on the `pg_stat_statements` table.
You can find more information about it on the official [docs](https://www.postgresql.org/docs/current/pgstatstatements.html#id-1.11.7.39.6).

Another interesting consideration here is explained in the following SO [question](https://stackoverflow.com/questions/50803147/what-is-the-timeframe-for-pg-stat-statements).
As a summary:
- The `pg_stat_statements` has no time data embedded in it.
- It will show all queries from the last reset (one can call `pg_stat_statements_reset()`).

Then, when extracting usage and lineage data, the query log duration will have no impact, only the query limit.

**Note:** For usage and lineage grant your user `pg_read_all_stats` permission.

```sql
GRANT pg_read_all_stats TO your_user;
```

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Postgres", 
    selectServicePath: "/images/v1.7/connectors/postgres/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/postgres/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/postgres/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing Postgres Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and a PostgreSQL database, you can configure SSL using different SSL modes provided by PostgreSQL, each offering varying levels of security.

Under `Advanced Config`, specify the SSL mode appropriate for your connection, such as `prefer`, `verify-ca`, `allow`, and others. After selecting the SSL mode, provide the CA certificate used for SSL validation (`caCertificate`). Note that PostgreSQL requires only the CA certificate for SSL validation.

{% note %}

For IAM authentication, it is recommended to choose the `allow` mode or another SSL mode that fits your specific requirements.

{% /note %}

{% image
  src="/images/v1.7/connectors/ssl_connection.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
