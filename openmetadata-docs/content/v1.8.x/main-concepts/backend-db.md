---
title: Backend DB 
slug: /main-concepts/backend-db
---

# Understanding the Backend DB

{% note %}

Note that this document is just to give transparency and clarity to anyone who is interested in understanding the backend database of OpenMetadata.

We DO NOT RECOMMEND using the database directly for any kind of operations. The database schema is subject to change and is not guaranteed to be stable across versions.
Any operations on the platform should be done through the OpenMetadata API.

{% /note %}

In this document we will talk about *Entities*. For us, an Entity is an object that contains metadata about a particular resource. 
For example, a Table is an Entity that contains metadata about a table in a database. Similarly, a Dashboard is an Entity that contains metadata about a dashboard in a BI tool.
The goal of the backend database is to store metadata about these Entities, as well as their relationships with each other.

This is a narrowed-down view of the database schema, focusing on the main tables and concepts that are relevant to the metadata storage. In *italics*
you will find the columns that are `GENERATED`:

{% image
src="/images/v1.8/main-concepts/backend-db/db-diagram.png"
alt="Backend DB Simplified Diagram"
caption="Backend DB Simplified Diagram"
/%}

## Entity Tables & JSON Columns

The backend database uses JSON columns to store metadata about Entities. This allows us to store metadata in a flexible way, without having to define a fixed schema for each Entity type.
This also helps in easily evolving the schema as we add new features to the platform.

Each Entity will have its own table, named `<entity>_entity`. For example, the Table Entity will have a table named `table_entity`.

The main columns you will find in an Entity table are:
1. `json`: Which contains the JSON representation of the Entity metadata. Most of the rest of the table columns are going to
  be `GENERATED` from this JSON column. E.g., `id`, `name`, `deleted`,...
2. `fqnHash`: A hash of the fully qualified name of the Entity. This is used to quickly lookup an Entity by its fully qualified name.
  Note that the fully qualified name (FQN) is a unique identifier for an Entity, and is a combination of the names of the
  Entity and its parents. For example, the FQN of a Table Entity will be `service.database.schema.table`.
  The `fqnHash` will be the hash of each element of this string `serviceHash.databaseHash.schemaHash.tableHash`.

## Relationships

Entities can have relationships with each other. For example, a Table Entity can have a relationship with a Database Entity, which represents the database that the table belongs to.
Also, users and teams can have relationships with any other object, when owning tables, dashboards, etc.

We are not storing all this information in the Entity tables. Instead, we have a separate table named `entity_relationship` to store relationships between Entities.

The main columns of the `entity_relationship` table are:
- `fromId`: The ID of the Entity from which the relationship originates.
- `toId`: The ID of the Entity to which the relationship points.
- `fromEntity`: The type of the Entity from which the relationship originates.
- `toEntity`: The type of the Entity to which the relationship points.
- `relation`: The type of the relationship. For example, `owns` or `contains`.

The `relation` types are defined - as everything else - as a [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/type/entityRelationship.json#L15).
While we use numbers on the database, you can find the human-readable names in the JSON Schema, being that the properly sorted list. For example:
1. A `user` `HAS` (10) a `role`
2. A `team` `OWNS` (8) a `table`
3. A `database` `CONTAINS` (0) a `databaseSchema`
4. A `classification` `CONTAINS` (0) a `tag`

## Tags

The Tags and Glossary Terms applied to an Entity live under `tag_usage`. This table contains the following columns:
1. `source`: Either classification (0) or glossary (1)
2. `tagFQN`: Tag being applied
3. `labelType`: Internally use to flag the origin of a tag ([source](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/type/tagLabel.json#L44))
4. `state`: Placeholder column with no use at the moment
5. `tagFQNHash`: Hash of the tagFQN
6. `tagetFQNHash`: Hash of the target Entity FQN

Then, here is where you can find the tags applied to any Entity or its children (e.g., columns of a table).

## Entity Extension

In this table we are extending the metadata from a specific asset (instead of storing the relationships to other assets). For example,
we are storing the versions of an asset, or its Custom Properties. Its columns are:

1. `id`: Entity ID
2. `extension`: Encodes the extension information, e.g., `table.version.0.1`, or `table.CustomProperties.<name>`
3. `jsonSchema`: Shape of the extension we are storing
4. `json`: The actual extension data

## Entity Extension  - Time Series

This is where we store extension information that is tied to a specific timestamp. For example, Web Analytics Data (used in Data Insights), or the status
of the Ingestion Pipeline runs. Its columns are:

1. `extension`: Encodes the extension information, e.g., `ingestionPipeline.pipelineStatus`, or `webAnalyticEvent.webAnalyticEventData`
2. `jsonSchema`: Shape of the extension we are storing
3. `json`: The actual extension data
4. `timestamp`: Timestamp of the extension data
5. `entityFQNHash`: Hash of the Entity FQN as described above

Note that in order to keep queries fast, we are storing profiling information in the `profiler_data_time_series`, Data Quality
results in `data_quality_data_time_series`, Incident Management results in `test_case_resolution_status_time_series`,
and `apps_extension_time_series` for Application runs, which have the same shape.

## Entity Usage

The Usage Workflows will store the usage information of your assets in the `entity_usage` table.

## Change Event & Consumers

The `change_event` table is used to store events that are generated when an Entity is created, updated, or deleted. This table is used to keep track of changes to the metadata in the system, and
is internally polled by the server to handle the observability and notification systems.

The `change_event`, `change_event_consumers` and `consumers_dlq` are internal tables and should not be used directly.

## Other Entities

- `test_connection_definition`: Stores the steps that are performed for each connector when testing the connection. This Entity is for internal use only. Note that these definitions
  are tightly coupled with the implementation on the Ingestion Framework.
- `test_definition`: Stored the tests that are available in the platform and the types they support.
- `test_case`: Stores the executed test cases and their results.
- `test_suite`: Stores the Test Suite Entity, which is used as a logical grouping of tests.

## QRTZ

There are 6 tables with the prefix `QRTZ_`. Those are used by the internal server scheduling tool of Applications such as the Indexing.

## Migration Tables

Originally, we relied on Flyway to manage the backend db migrations. Flyway used the `DATABASE_CHANGE_LOG` table
to store the migration information.

In recent releases we switched to an in-house migration system which allows us to perform db migrations in a more controlled way.
The internal tables for this system are `SERVER_CHANGE_LOG` and `SERVER_MIGRATION_SQL_LOGS`.

These tables are for internal use only.
