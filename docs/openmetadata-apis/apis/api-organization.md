# API Organization

OpenMetadata has the following APIs. See this [sandbox link](https://sandbox.open-metadata.org/docs) for full documentation related to APIs.

* **Data Asset APIs** - These API endpoints support operations related to data asset entities.
  * `.../api/v1/databases`
  * `...api/v1/tables`
  * `.../api/v1/metrics`
  * `.../api/v1/dashboards`
  * `.../api/v1/reports`
  * `.../api/v1/pipelines`
  * `.../api/v1/topics`
* **Service APIs** - These API endpoints support operations related to services from which metadata is collected:
  * `.../api/v1/services` is the collection of all service resources.
  * `.../api/v1/services/databaseService` - APIs related to database services. This includes transactional databases - MySQL, Postgres, MSSQL, Oracle, and data warehouses - Apache Hive BigQuery, Redshift, and Snowflake.
  * `.../api/v1/services/dashboardService` - APIs related to dashboard services. This includes Looker, Superset, and Tableau.
  * `.../api/v1/services/messaingService` - APIs related to messaging services. This includes Apache Kafka and Apache Pulsar (work in progress).
* **Teams & Users APIs**
  * `.../api/v1/teams` - APIs related to team entities
  * `.../api/v1/users` - APIs related to user entities
* **Search & Suggest APIs -** These API endpoints support search and suggest APIs:
  * `.../api/v1/search` - collection for search and suggest APIs
  * `.../api/v1/search/query` - search entities using query text
  * `.../api/v1/search/suggest` - get suggested entities used for auto-completion
* **Other APIs**
  * `.../api/v1/tags` for APIs related to Tag Category and Tag entities
  * `../api/v1/feeds` for APIs related to Threads and Posts entities
  * `.../api/v1/usage` for reporting usage information of entities
