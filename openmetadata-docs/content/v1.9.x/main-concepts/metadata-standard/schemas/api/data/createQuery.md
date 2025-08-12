---
title: Create Query API | OpenMetadata Query API
description: Define a new SQL query entity with metadata such as query text, owner, and associated data entities for better discoverability and lineage.
slug: /main-concepts/metadata-standard/schemas/api/data/createquery
---

# CreateQueryRequest

*Create Query Request*

## Properties

- **`name`**: Name of a Query in case of User Creation. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this query.
- **`description`**: Description of the query instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owners`**: Owners of this entity. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`tags`** *(array)*: Tags for this Query. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`query`**: SQL Query definition. Refer to *[../../type/basic.json#/definitions/sqlQuery](#/../type/basic.json#/definitions/sqlQuery)*.
- **`query_type`** *(string)*: SQL query type.
- **`exclude_usage`** *(boolean)*: Flag to check if query is to be excluded while processing usage.
- **`duration`** *(number)*: How long did the query took to run in milliseconds.
- **`users`** *(array)*: UserName of the user running the query.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`usedBy`** *(array)*: List of users who ran the query but does not exist in OpenMetadata.
  - **Items** *(string)*
- **`dialect`** *(string)*: SQL dialect.
- **`queryDate`**: Date on which the query ran. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`queryUsedIn`**: list of entities to which the query is joined. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`triggeredBy`**: Entity that triggered the query. E.g., a Stored Procedure or a Pipeline Task. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`processedLineage`** *(boolean)*: Flag if this query has already been successfully processed for lineage. Default: `false`.
- **`service`**: Link to the database service fully qualified name where this query has been run. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
