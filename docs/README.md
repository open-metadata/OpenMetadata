# Introduction

OpenMetadata is an open standard with a centralized metadata store and ingestion framework supporting [connectors](install/metadata-ingestion/connectors/) for a wide range of services. The metadata ingestion framework enables you to customize or add support for any service. REST APIs enable you to integrate OpenMetadata with existing tool chains. Using the OpenMetadata user interface (UI), data consumers can discover the right data to use in decision making and data producers can assess usage and consumer experience in order to plan improvements and prioritize bug fixes.

OpenMetadata enables metadata management end-to-end, giving you the ability to unlock the value of data assets in the common use cases of data discovery and governance, but also in emerging use cases related to data quality, observability, and people collaboration.

{% embed url="https://youtu.be/3xaHf3A2PgU" %}

## Connectors

OpenMetadata provides connectors that enable you to perform metadata ingestion from a number of common database, dashboard, messaging, and pipeline services. With each release, we add additional connectors and the ingestion framework provides a structured and straightforward method for creating your own connectors. See the table below for a list of supported connectors.

| A-H                                                         | K-M                                         | N-R                                                         | S-Z                                                           |
| ----------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| [Airflow](install/metadata-ingestion/airflow/)              | [Kafka](openmetadata/connectors/kafka.md)   | [Oracle](openmetadata/connectors/oracle.md)                 | Salesforce                                                    |
| [Athena](openmetadata/connectors/athena.md)                 | [Looker](openmetadata/connectors/looker.md) | [Postgres](openmetadata/connectors/postgres.md)             | [Snowflake](openmetadata/connectors/snowflake.md)             |
| [BigQuery](openmetadata/connectors/bigquery.md)             | [MariaDB](connectors/mariadb.md)            | [Presto](openmetadata/connectors/presto.md)                 | [Snowflake Usage](openmetadata/connectors/snowflake-usage.md) |
| [BigQuery Usage](openmetadata/connectors/bigquery-usage.md) | Metabase                                    | [Redash](openmetadata/connectors/redash.md)                 | [Superset](openmetadata/connectors/superset.md)               |
| [DBT](connectors/dbt.md)                                    | [MLflow](connectors/mlflow.md)              | [Redshift](openmetadata/connectors/redshift.md)             | [Tableau](openmetadata/connectors/tableau.md)                 |
| [Elasticsearch](openmetadata/connectors/elastic-search.md)  | [MSSQL](openmetadata/connectors/mssql.md)   | [Redshift Usage](openmetadata/connectors/redshift-usage.md) | [Trino](openmetadata/connectors/trino.md)                     |
| [Glue Catalog](connectors/glue-catalog.md)                  | [MySQL](openmetadata/connectors/mysql.md)   |                                                             | [Vertica](openmetadata/connectors/vertica.md)                 |
| [Hive](openmetadata/connectors/hive.md)                     |                                             |                                                             |                                                               |
|                                                             |                                             |                                                             |                                                               |
|                                                             |                                             |                                                             |                                                               |
|                                                             |                                             |                                                             |                                                               |
|                                                             |                                             |                                                             |                                                               |
|                                                             |                                             |                                                             |                                                               |
|                                                             |                                             |                                                             |                                                               |
|                                                             |                                             |                                                             |                                                               |
|                                                             |                                             |                                                             |                                                               |
|                                                             |                                             |                                                             |                                                               |
|                                                             |                                             |                                                             |                                                               |
|                                                             |                                             |                                                             |                                                               |
|                                                             |                                             |                                                             |                                                               |

## OpenMetadata Components

The key components of OpenMetadata include the following:

* **OpenMetadata User Interface (UI)** - a central place for users to discover and collaborate on all data. See [Features](features.md) for an overview of the OpenMetadata UI.
* **Ingestion framework** - a pluggable framework for integrating tools and ingesting metadata to the metadata store. The ingestion framework already supports well-known data warehouses. See the [Connectors](./#connectors) section for a complete list and documentation on supported services.
* **Metadata APIs** - for producing and consuming metadata built on schemas for User Interfaces and for Integrating tools, systems, and services. See the API [Overview](openmetadata-apis/apis/overview.md) for details.
* **Metadata store** - stores a metadata graph that connects data assets and user and tool generated metadata.
* **Metadata schemas** - defines core abstractions and vocabulary for metadata with schemas for Types, Entities, and Relationships between entities. This is the foundation of the Open Metadata Standard. See the [Schema Concepts](openmetadata-apis/schemas/overview.md) section to learn more about metadata schemas.

![](<.gitbook/assets/openmetadata-overview (1).png>)

## License

OpenMetadata is released under [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)
