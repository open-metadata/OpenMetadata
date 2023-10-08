---
title: query
slug: /main-concepts/metadata-standard/schemas/entity/data/query
---

# Query

*This schema defines the type to capture any data asset's queries.*

## Properties

- **`id`**: Unique identifier of the query. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of a entity to which the query belong. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: Fully qualified name of a query. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this Query. It could be title or label.
- **`description`**: Description of a query. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the query.
- **`href`**: Link to this Query resource. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`owner`**: Owner of this Query. Refer to *../../type/entityReference.json*. Default: `None`.
- **`duration`** *(number)*: How long did the query took to run in seconds.
- **`users`** *(array)*: List of users who ran this query. Default: `None`.
  - **Items**: Refer to *../../type/entityReference.json*.
- **`followers`**: Followers of this Query. Refer to *../../type/entityReferenceList.json#/definitions/entityReferenceList*.
- **`votes`**: Refer to *../../type/votes.json*.
- **`query`**: SQL Query definition. Refer to *../../type/basic.json#/definitions/sqlQuery*.
- **`checksum`** *(string)*: Checksum to avoid registering duplicate queries.
- **`queryDate`**: Date on which the query ran. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`tags`** *(array)*: Tags for this SQL query. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`queryUsedIn`**: Entities that are using this query. Refer to *../../type/entityReferenceList.json#/definitions/entityReferenceList*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
