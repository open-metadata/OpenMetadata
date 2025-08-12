---
title: query
slug: /main-concepts/metadata-standard/schemas/entity/data/query
---

# Query

*This schema defines the type to capture any data asset's queries.*

## Properties

- **`id`**: Unique identifier of the query. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of an entity to which the query belongs to. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: Fully qualified name of a query. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this Query. It could be title or label.
- **`description`**: Description of a query. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the query.
- **`href`**: Link to this Query resource. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`owners`**: Owners of this Query. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`duration`** *(number)*: How long did the query took to run in milliseconds.
- **`users`** *(array)*: List of users who ran this query. Default: `None`.
  - **Items**: Refer to *../../type/entityReference.json*.
- **`followers`**: Followers of this Query. Refer to *../../type/entityReferenceList.json*.
- **`votes`**: Votes on the entity. Refer to *../../type/votes.json*.
- **`query`**: SQL Query definition. Refer to *../../type/basic.json#/definitions/sqlQuery*.
- **`query_type`** *(string)*: SQL query type.
- **`exclude_usage`** *(boolean)*: Flag to check if query is to be excluded while processing usage.
- **`checksum`** *(string)*: Checksum to avoid registering duplicate queries.
- **`queryDate`**: Date on which the query ran. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`usedBy`** *(array)*: List of users who ran the query but does not exist in OpenMetadata.
  - **Items** *(string)*
- **`tags`** *(array)*: Tags for this SQL query. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`queryUsedIn`**: Entities that are using this query. Refer to *../../type/entityReferenceList.json*.
- **`triggeredBy`**: Entity that triggered the query. E.g., a Stored Procedure or a Pipeline Task. Refer to *../../type/entityReference.json*.
- **`processedLineage`** *(boolean)*: Flag if this query has already been successfully processed for lineage. Default: `False`.
- **`service`**: Link to the service this query belongs to. Refer to *../../type/entityReference.json*.
- **`domains`**: Domains the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *../../type/entityReferenceList.json*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
