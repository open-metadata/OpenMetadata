---
title: esLineageData
slug: /main-concepts/metadata-standard/schemas/api/lineage/eslineagedata
---

# EsLineageData

*Response object for the search lineage request from Elastic Search.*

## Properties

- **`fromEntity`**: From Entity. Refer to *#/definitions/relationshipRef*.
- **`toEntity`**: To Entity. Refer to *#/definitions/relationshipRef*.
- **`pipeline`**: Pipeline in case pipeline is present between entities.
- **`sqlQuery`** *(string)*: Sql Query associated.
- **`columns`** *(array)*: Columns associated.
  - **Items**: Refer to *../../type/entityLineage.json#/definitions/columnLineage*.
- **`description`** *(string)*: Description.
- **`source`** *(string)*: Source of the Lineage.
- **`docId`** *(string)*: Doc Id for the Lineage.
- **`docUniqueId`** *(string)*: Doc Unique Id for the Lineage.
- **`pipelineEntityType`** *(string)*: Pipeline Entity or Stored procedure.
- **`createdAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`createdBy`** *(string)*: User who created the node.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`assetEdges`** *(integer)*: Asset count in case of child assets lineage. Default: `None`.
## Definitions

- **`relationshipRef`** *(object)*: Relationship Reference to an Entity.
  - **`id`**: Unique identifier of this entity instance. Refer to *../../type/basic.json#/definitions/uuid*.
  - **`fullyQualifiedName`**: FullyQualifiedName of the entity. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
  - **`fqnHash`** *(string)*: FullyQualifiedName Hash of the entity.
  - **`type`** *(string)*: Type of the entity.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
