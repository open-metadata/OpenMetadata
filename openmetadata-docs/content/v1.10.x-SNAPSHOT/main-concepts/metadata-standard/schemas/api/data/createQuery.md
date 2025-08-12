---
title: createQuery
slug: /main-concepts/metadata-standard/schemas/api/data/createquery
---

# CreateQueryRequest

*Create Query Request*

## Properties

- **`name`**: Name of a Query in case of User Creation. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this query.
- **`description`**: Description of the query instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owners`**: Owners of this entity. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`tags`** *(array)*: Tags for this Query. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`query`**: SQL Query definition. Refer to *../../type/basic.json#/definitions/sqlQuery*.
- **`query_type`** *(string)*: SQL query type.
- **`exclude_usage`** *(boolean)*: Flag to check if query is to be excluded while processing usage.
- **`duration`** *(number)*: How long did the query took to run in milliseconds.
- **`users`** *(array)*: UserName of the user running the query.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`usedBy`** *(array)*: List of users who ran the query but does not exist in OpenMetadata.
  - **Items** *(string)*
- **`dialect`** *(string)*: SQL dialect.
- **`queryDate`**: Date on which the query ran. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`queryUsedIn`**: list of entities to which the query is joined. Refer to *../../type/entityReferenceList.json*.
- **`triggeredBy`**: Entity that triggered the query. E.g., a Stored Procedure or a Pipeline Task. Refer to *../../type/entityReference.json*.
- **`processedLineage`** *(boolean)*: Flag if this query has already been successfully processed for lineage. Default: `False`.
- **`service`**: Link to the database service fully qualified name where this query has been run. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the Query belongs to.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
