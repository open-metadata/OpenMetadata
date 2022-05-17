# Introduction

OpenMetadata is an open standard with a centralized metadata store and ingestion framework supporting [connectors](docs/integrations/connectors/) for a wide range of services. The metadata ingestion framework enables you to customize or add support for any service. REST APIs enable you to integrate OpenMetadata with existing tool chains. Using the OpenMetadata user interface (UI), data consumers can discover the right data to use in decision making and data producers can assess usage and consumer experience in order to plan improvements and prioritize bug fixes.

OpenMetadata enables metadata management end-to-end, giving you the ability to unlock the value of data assets in the common use cases of data discovery and governance, but also in emerging use cases related to data quality, observability, and people collaboration.

{% embed url="https://youtu.be/pF8L_mAtexo" %}

## Connectors

OpenMetadata provides connectors that enable you to perform metadata ingestion from a number of common database, dashboard, messaging, and pipeline services. With each release, we add additional connectors and the ingestion framework provides a structured and straightforward method for creating your own connectors. See the table below for a list of supported connectors.

| A-H                                                             | I-M                                                | N-R                                                                | S-Z                                                        |
| --------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| [Airflow](docs/integrations/airflow/)                           | [IBM Db2](docs/integrations/connectors/ibm-db2.md) | [Oracle](docs/integrations/connectors/mysql-2/)                    | [Salesforce](integrations/connectors/singlestore/)         |
| Amundsen                                                        | [Kafka](docs/integrations/connectors/kafka.md)     | [Postgres](<docs/integrations/connectors/snowflake/README (1).md>) | [SingleStore](integrations/connectors/singlestore-1/)      |
| Apache Atlas                                                    | LDAP                                               | Power BI                                                           | [Snowflake](docs/integrations/connectors/snowflake/)       |
| Apache Druid                                                    | [Looker](integrations/connectors/mysql/)           | Prefect                                                            | [Snowflake Usage](docs/integrations/connectors/snowflake/) |
| [Athena](docs/integrations/connectors/athena/)                  | [MariaDB](docs/integrations/connectors/mariadb.md) | [Presto](integrations/connectors/mysql-2-1/)                       | [Superset](integrations/connectors/mysql-3/)               |
| [Azure SQL](broken-reference)                                   | [Metabase](integrations/connectors/mysql-1/)       | [Redash](integrations/connectors/mysql-1-2/)                       | [Tableau](docs/integrations/connectors/tableau.md)         |
| [BigQuery](docs/integrations/connectors/bigquery/)              | [MLflow](docs/integrations/connectors/mlflow/)     | [Redshift](docs/integrations/connectors/redshift/)                 | [Trino](docs/integrations/connectors/trino/)               |
| [BigQuery Usage](docs/integrations/connectors/bigquery/)        | [MSSQL](integrations/connectors/mssql-1-1/)        | [Redshift Usage](docs/integrations/connectors/redshift/)           | [Vertica](docs/integrations/connectors/vertica.md)         |
| [ClickHouse](docs/integrations/connectors/snowflake-2/)         | [MSSQL Usage](integrations/connectors/mssql-1-1/)  |                                                                    |                                                            |
| [ClickHouse Usage](docs/integrations/connectors/snowflake-2/)   | [MySQL](integrations/connectors/mysql-1-1/)        |                                                                    |                                                            |
| [Databricks](integrations/connectors/databricks/)               |                                                    |                                                                    |                                                            |
| [DBT](data-lineage/dbt-integration/)                            |                                                    |                                                                    |                                                            |
| [Delta Lake](docs/integrations/connectors/delta-lake.md)        |                                                    |                                                                    |                                                            |
| [DynamoDB](docs/integrations/connectors/dynamodb.md)            |                                                    |                                                                    |                                                            |
| [Elasticsearch](docs/integrations/connectors/elastic-search.md) |                                                    |                                                                    |                                                            |
| [Glue Catalog](docs/integrations/connectors/glue-catalog/)      |                                                    |                                                                    |                                                            |
| [Hive](docs/integrations/connectors/hive/)                      |                                                    |                                                                    |                                                            |

## OpenMetadata Components

The key components of OpenMetadata include the following:

* **OpenMetadata User Interface (UI)** - a central place for users to discover and collaborate on all data. See [Features](docs/overview/features.md) for an overview of the OpenMetadata UI.
* **Ingestion framework** - a pluggable framework for integrating tools and ingesting metadata to the metadata store. The ingestion framework already supports well-known data warehouses. See the [Connectors](./#connectors) section for a complete list and documentation on supported services.
* **Metadata APIs** - for producing and consuming metadata built on schemas for User Interfaces and for Integrating tools, systems, and services. See the API [Overview](docs/openmetadata-apis/apis/overview.md) for details.
* **Metadata store** - stores a metadata graph that connects data assets and user and tool generated metadata.
* **Metadata schemas** - defines core abstractions and vocabulary for metadata with schemas for Types, Entities, and Relationships between entities. This is the foundation of the Open Metadata Standard. See the [Schema Concepts](docs/openmetadata-apis/schemas/overview.md) section to learn more about metadata schemas.

![](<.gitbook/assets/openmetadata-overview (1).png>)

## License

OpenMetadata is released under [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)
