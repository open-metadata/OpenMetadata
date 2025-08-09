---
title: APIs | `brandName` Metadata Standard APIs
slug: /main-concepts/metadata-standard/apis
---

# APIs

OpenMetadata supports REST APIs for getting data and in and out of the metadata service. APIs are built using general
best practices of REST API design. We take a schema-first approach by defining Types and Entities in JSON Schema. We
implement APIs based on these schemas.

## Overview

### URI

Following REST API conventions are followed for Resource URIs:
- Operations for an entity are available through the Resource URI as a collection `.../api/<version>/entities`. 
- Plural of the entity name is used as the collection name - example `.../api/v1/users`.
- Trailing forward slash is not used in the endpoint URI. Example use `.../api/v1/databases` instead of `.../api/v1/databases/`.
- Resource URI for an entity instance by the entity id is `.../api/v1/entities/{id}`. 
- Resource URI for an entity instance by name is `.../api/v1/entities/name/{name}`.

### Resource Representation

- The REST API calls return a response with JSON `Content-Type` and `Content-Length` that includes the length of the response.
- All responses include the Resource ID field even though the id was provided in the request to simplify the consumption 
  of the response at the client.
- Entity names and field names use `camelCase` per Javascript naming convention.
- All resources include an attribute `href` with Resource URI. All relationship fields of an entity will also 
  include `href` links to the related resource for easy access.
- Unknown fields sent by the client in API requests are not ignored to ensure the data sent by the client is not dropped 
  at the server without the user being aware of it.

## API Organization

You can find the swagger documentation [here](/swagger.html). In a nutshell:

**Data Asset APIs** - support operations related to data asset entities.
- `.../api/v1/databases`
- `...api/v1/tables`
- `.../api/v1/metrics`
- `.../api/v1/dashboards`
- `.../api/v1/reports`
- `.../api/v1/pipelines`
- `.../api/v1/topics`

**Service APIs** - support operations related to services from which metadata is collected:
- `.../api/v1/services` is the collection of all service resources.
- `.../api/v1/services/databaseService` - APIs related to database services. This includes Transactional databases - MySQL, Postgres, MSSQL, Oracle, and Data Warehouses - Apache Hive BigQuery, Redshift, and Snowflake.
- `.../api/v1/services/dashboardService` - APIs related to Dashboard Services. This includes Looker, Superset, and Tableau.
- `.../api/v1/services/messagingService` - APIs related to Messaging Services. This includes Apache Kafka, Redpanda, - Kinesis, and others.

**Teams & Users APIs**
- `.../api/v1/teams` - APIs related to team entities
- `.../api/v1/users` - APIs related to user entities

**Search & Suggest APIs** - support search and suggest APIs:
- `.../api/v1/search` - collection for search and suggest APIs
- `.../api/v1/search/query` - search entities using query text
- `.../api/v1/search/suggest` - get suggested entities used for auto-completion

**Other APIs**
- `.../api/v1/tags` for APIs related to Classification and Tag entities
- `../api/v1/feeds` for APIs related to Threads and Posts entities
- `.../api/v1/usage` for reporting usage information of entities
