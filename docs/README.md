# Introduction

OpenMetadata is an open standard with a centralized metadata store and ingestion framework supporting [connectors](../connectors/connectors/) for a wide range of services. The metadata ingestion framework enables you to customize or add support for any service. REST APIs enable you to integrate OpenMetadata with existing tool chains. Using the OpenMetadata user interface (UI), data consumers can discover the right data to use in decision making and data producers can assess usage and consumer experience in order to plan improvements and prioritize bug fixes.

OpenMetadata enables metadata management end-to-end, giving you the ability to unlock the value of data assets in the common use cases of data discovery and governance, but also in emerging use cases related to data quality, observability, and people collaboration.

{% embed url="https://youtu.be/3xaHf3A2PgU" %}

## Connectors

OpenMetadata provides connectors that enable you to perform metadata ingestion from a number of common database, dashboard, messaging, and pipeline services. With each release, we add additional connectors and the ingestion framework provides a structured and straightforward method for creating your own connectors. See the table below for a list of supported connectors.

| A-H                                                                                            | I-M                                              | N-R                                                          | S-Z                                                            |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------- |
| [Airflow](../connectors/connectors/airflow/airflow.md)                                         | [Kafka](../connectors/connectors/kafka.md)       | [Oracle](../connectors/connectors/oracle.md)                 | [Salesforce](../connectors/connectors/salesforce.md)           |
| Amundsen                                                                                       | [Looker](../connectors/connectors/looker.md)     | [Postgres](connectors/connectors/postgres/)                  | [Snowflake](connectors/connectors/snowflake/)                  |
| Apache Atlas                                                                                   | [MariaDB](../connectors/connectors/mariadb.md)   | [Presto](../connectors/connectors/presto.md)                 | [Snowflake Usage](../connectors/connectors/snowflake-usage.md) |
| Apache Druid                                                                                   | [Metabase](../connectors/connectors/metabase.md) | [Redash](../connectors/connectors/redash.md)                 | [Superset](../connectors/connectors/superset.md)               |
| [Athena](../connectors/connectors/athena.md)                                                   | [MLflow](../connectors/connectors/mlflow.md)     | [Redshift](connectors/connectors/redshift/)                  | [Tableau](../connectors/connectors/tableau.md)                 |
| [BigQuery](connectors/connectors/bigquery/)                                                    | [MSSQL](connectors/connectors/mssql/)            | [Redshift Usage](../connectors/connectors/redshift-usage.md) | [Trino](../connectors/connectors/trino.md)                     |
| [BigQuery Usage](../connectors/connectors/bigquery-usage.md)                                   | [MySQL](openmetadata/connectors/mysql.md)        |                                                              | [Vertica](../connectors/connectors/vertica.md)                 |
| [DBT](https://github.com/open-metadata/OpenMetadata/blob/main/docs/broken-reference/README.md) |                                                  |                                                              |                                                                |
| [Elasticsearch](../connectors/connectors/elastic-search.md)                                    |                                                  |                                                              |                                                                |
| [Glue Catalog](connectors/connectors/glue-catalog/)                                            |                                                  |                                                              |                                                                |
| [Hive](../connectors/connectors/hive.md)                                                       |                                                  |                                                              |                                                                |

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
