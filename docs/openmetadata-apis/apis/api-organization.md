# API Organization

OpenMetadata has the following APIs. See this [sandbox link](https://sandbox.open-metadata.org/docs) for full documentation related to APIs.

* Data Asset APIs - These API endpoints support operations related to data asset entities. 
  * `.../api/v1/databases`
  * `...api/v1/tables`
  * `.../api/v1/metrics`
  * `.../api/v1/dashboards`
  * `.../api/v1/reports`
  * `.../api/v1/pipelines`
* Service APIs - These API endpoints support operations related to services from which metadata is collected: 
  * `.../api/v1/services` is the collection of all service resources.
  * `.../api/v1/services/databaseService` is a resource used for APIs related to database services. This includes transactional databases - MySQL, Postgres, MSSQL, Oracle, and data warehouses - Apache Hive BigQuery, Redshift, and Snowflake. 
* Teams & Users
  * `.../api/v1/teams` for APIs related to team entities
  * `.../api/v1/users` for APIs related to user entities
* Other APIs
  * `.../api/v1/tags` for APIs related to Tag Category and Tag entities
  * `../api/v1/feeds` for APIs related to Threads and Posts entities
  * `.../api/v1/usage` for reporting usage information of entities
  * `.../api/v1/search` for APIs related to entity search

