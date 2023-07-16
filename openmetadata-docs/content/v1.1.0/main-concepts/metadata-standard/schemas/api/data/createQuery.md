---
title: createQuery
slug: /main-concepts/metadata-standard/schemas/api/data/createquery
---

# CreateQueryRequest

*Create Query Request*

## Properties

- **`name`**: Name of a Query in case of User Creation. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this query.
- **`description`**: Description of the query instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owner`**: Owner of this entity. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*. Default: `null`.
- **`tags`** *(array)*: Tags for this Query. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`query`**: SQL Query definition. Refer to *[../../type/basic.json#/definitions/sqlQuery](#/../type/basic.json#/definitions/sqlQuery)*.
- **`duration`** *(number)*: How long did the query took to run in seconds.
- **`users`** *(array)*: UserName of the user running the query.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`queryDate`**: Date on which the query ran. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`queryUsedIn`**: list of entities to which the query is joined. Refer to *[../../type/entityReferenceList.json#/definitions/entityReferenceList](#/../type/entityReferenceList.json#/definitions/entityReferenceList)*.


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
