---
title: Understand OpenMetadata API Organization
slug: /developers/apis/api-organization
---

# API Organization

OpenMetadata has the following APIs. See this [API documentation](https://docs.open-metadata.org/swagger.html) for full details API endpoints.

* **Data Asset APIs** - These API endpoints support operations related to data asset entities.
  * `.../api/v1/databases`
  * `.../api/v1/databaseSchemas`
  * `.../api/v1/tables`
  * `.../api/v1/metrics`
  * `.../api/v1/dashboards`
  * `.../api/v1/dashboards/datamodels`
  * `.../api/v1/charts`
  * `.../api/v1/reports`
  * `.../api/v1/pipelines`
  * `.../api/v1/topics`
  * `.../api/v1/mlmodels`
  * `.../api/v1/containers`
* **Service APIs** - These API endpoints support operations related to services from which metadata is collected:
  * `.../api/v1/services` - A collection of all service resources.
  * `.../api/v1/services/databaseService` - APIs related to database services. This includes transactional databases - MySQL, Postgres, MSSQL, Oracle, and data warehouses - Apache Hive BigQuery, Redshift, and Snowflake.
  * `.../api/v1/services/dashboardService` - APIs related to dashboard services. This includes Looker, Superset, and Tableau.
  * `.../api/v1/services/messaingService` - APIs related to messaging services. This includes Apache Kafka and Apache Pulsar.
  * `.../api/v1/services/metadataServices` - APIs related to creating and managing other Metadata Services that OpenMetadata integrates with such as Apache Atlas, Amundsen, etc.
  * `.../api/v1/services/storageServices` - APIs related Object Store Service entities, such as S3, GCS or AZURE.
  * `.../api/v1/services/mlmodelServices` - APIs related to ML Model Services.
  * `.../api/v1/services/pipelineServices` - APIs related to pipeline Services.
* **Data Quality APIs**
  * `.../api/v1/dataQuality/testSuites` - A set of test cases grouped together to capture data quality.
  * `.../api/v1/dataQuality/testDefinitions` - A definition of a type of test using which test cases are created that run against data to capture data quality.
  * `.../api/v1/dataQuality/testCases` - Test case is a specification of a test definition to capture data quality tests against tables, columns, and other data assets.
* **Lineage**
  * `.../api/v1/lineage` The Lineage for a given data asset, has information of the input datasets used and the ETL pipeline that created it.
* **Teams & Users APIs**
  * `.../api/v1/teams` - APIs related to team entities
  * `.../api/v1/users` - APIs related to user entities
  * `.../api/v1/permissions` - APIs related to getting access permission for a User.
  * `.../api/v1/policies` - A Policy defines control that needs to be applied across different Data Entities.
  * `.../api/v1/roles` - A Role is a collection of Policies that provides access control. A user or a team can be assigned one or multiple roles that provide privileges to a user and members of a team to perform the job function.
* **Search & Suggest APIs -** These API endpoints support search and suggest APIs:
  * `.../api/v1/search` - collection for search and suggest APIs
  * `.../api/v1/search/query` - search entities using query text
  * `.../api/v1/search/suggest` - get suggested entities used for auto-completion
* **Other APIs**
  * `.../api/v1/classifications` - These APIs are related to Classification and Tags. A Classification entity contains hierarchical terms called Tags used for categorizing and classifying data assets and other entities.
  * `../api/v1/feeds` - APIs related to Threads and Posts entities
  * `.../api/v1/usage` - APIs for reporting usage information of entities
  * `.../api/v1/bots` - APIS for operations related to bots management
  * `.../api/v1/events` - changes to metadata and are sent when entities are created, modified, or updated. External systems can subscribe to events using event subscription API over Webhooks, Slack, or Microsoft Teams.
  * `.../api/v1/feeds` - Feeds API supports Activity Feeds and Conversation Threads.
  * `.../api/v1/glossaries` - A Glossary is collection of hierarchical GlossaryTerms.
  * `.../api/v1/queries` - A Query entity represents a SQL query associated with data assets it is run against.
  * `.../api/v1/usage` - APIs related usage of data assets.
  * `.../api/v1/system` - APIs related to System configuration and settings.

 