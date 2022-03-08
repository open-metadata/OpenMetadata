# Introduction

OpenMetadata is an open standard with a centralized metadata store and ingestion framework supporting [connectors](integrations/connectors/) for a wide range of services. The metadata ingestion framework enables you to customize or add support for any service. REST APIs enable you to integrate OpenMetadata with existing tool chains. Using the OpenMetadata user interface (UI), data consumers can discover the right data to use in decision making and data producers can assess usage and consumer experience in order to plan improvements and prioritize bug fixes.

OpenMetadata enables metadata management end-to-end, giving you the ability to unlock the value of data assets in the common use cases of data discovery and governance, but also in emerging use cases related to data quality, observability, and people collaboration.

{% embed url="https://youtu.be/3xaHf3A2PgU" %}

## Connectors

OpenMetadata provides connectors that enable you to perform metadata ingestion from a number of common database, dashboard, messaging, and pipeline services. With each release, we add additional connectors and the ingestion framework provides a structured and straightforward method for creating your own connectors. See the table below for a list of supported connectors.

| A-H                                                                                            | I-M                                             | N-R                                                         | S-Z                                                           |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| [Airflow](integrations/connectors/airflow/airflow.md)                                          | [Kafka](integrations/connectors/kafka.md)       | [Oracle](integrations/connectors/oracle.md)                 | [Salesforce](integrations/connectors/salesforce.md)           |
| Amundsen                                                                                       | [Looker](integrations/connectors/looker.md)     | [Postgres](integrations/connectors/postgres/)               | [Snowflake](integrations/connectors/snowflake/)               |
| Apache Atlas                                                                                   | [MariaDB](integrations/connectors/mariadb.md)   | [Presto](integrations/connectors/presto.md)                 | [Snowflake Usage](integrations/connectors/snowflake-usage.md) |
| Apache Druid                                                                                   | [Metabase](integrations/connectors/metabase.md) | [Redash](integrations/connectors/redash.md)                 | [Superset](integrations/connectors/superset.md)               |
| [Athena](integrations/connectors/athena.md)                                                    | [MLflow](integrations/connectors/mlflow.md)     | [Redshift](integrations/connectors/redshift/)               | [Tableau](integrations/connectors/tableau.md)                 |
| [BigQuery](integrations/connectors/bigquery/)                                                  | [MSSQL](integrations/connectors/mssql/)         | [Redshift Usage](integrations/connectors/redshift-usage.md) | [Trino](integrations/connectors/trino.md)                     |
| [BigQuery Usage](integrations/connectors/bigquery-usage.md)                                    | [MySQL](integrations/connectors/mysql/mysql.md) |                                                             | [Vertica](integrations/connectors/vertica.md)                 |
| [DBT](https://github.com/open-metadata/OpenMetadata/blob/main/docs/broken-reference/README.md) |                                                 |                                                             |                                                               |
| [Elasticsearch](integrations/connectors/elastic-search.md)                                     |                                                 |                                                             |                                                               |
| [Glue Catalog](integrations/connectors/glue-catalog/)                                          |                                                 |                                                             |                                                               |
| [Hive](integrations/connectors/hive.md)                                                        |                                                 |                                                             |                                                               |

## OpenMetadata Components

The key components of OpenMetadata include the following:

* **OpenMetadata User Interface (UI)** - a central place for users to discover and collaborate on all data. See [Features](features.md) for an overview of the OpenMetadata UI.
* **Ingestion framework** - a pluggable framework for integrating tools and ingesting metadata to the metadata store. The ingestion framework already supports well-known data warehouses. See the [Connectors](./#connectors) section for a complete list and documentation on supported services.
* **Metadata APIs** - for producing and consuming metadata built on schemas for User Interfaces and for Integrating tools, systems, and services. See the API [Overview](openmetadata-apis/apis/overview.md) for details.
* **Metadata store** - stores a metadata graph that connects data assets and user and tool generated metadata.
* **Metadata schemas** - defines core abstractions and vocabulary for metadata with schemas for Types, Entities, and Relationships between entities. This is the foundation of the Open Metadata Standard. See the [Schema Concepts](openmetadata-apis/schemas/overview.md) section to learn more about metadata schemas.

![](<../.gitbook/assets/openmetadata-overview (1).png>)

## License

OpenMetadata is released under [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)
