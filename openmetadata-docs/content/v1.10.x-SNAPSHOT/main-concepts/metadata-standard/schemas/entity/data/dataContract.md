---
title: dataContract
slug: /main-concepts/metadata-standard/schemas/entity/data/datacontract
---

# DataContract

*A `DataContract` entity defines the schema and quality guarantees for a data asset.*

## Properties

- **`id`**: Unique identifier of this data contract instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of the data contract. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display name of the data contract.
- **`fullyQualifiedName`**: Fully qualified name of the data contract. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of the data contract. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to this data contract resource. Refer to *../../type/basic.json#/definitions/href*.
- **`status`**: Refer to *#/definitions/contractStatus*. Default: `Draft`.
- **`entity`**: Reference to the data entity (table, topic, etc.) this contract applies to. Refer to *../../type/entityReference.json*.
- **`testSuite`**: Reference to the test suite that contains tests related to this data contract. Refer to *../../type/entityReference.json*.
- **`schema`** *(array)*: Schema definition for the data contract. Default: `None`.
  - **Items**: Refer to *./table.json#/definitions/column*.
- **`semantics`** *(array)*: Semantics rules defined in the data contract. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/semanticsRule*.
- **`qualityExpectations`** *(array)*: Quality expectations defined in the data contract. Default: `None`.
  - **Items**: Refer to *../../type/entityReference.json*.
- **`contractUpdates`** *(array)*: History of updates to the data contract. Default: `None`.
  - **Items**: Refer to *#/definitions/contractUpdate*.
- **`owners`**: Owners of this data contract. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`reviewers`**: User references of the reviewers for this data contract. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`effectiveFrom`**: Date from which this data contract is effective. Refer to *../../type/basic.json#/definitions/dateTime*. Default: `None`.
- **`effectiveUntil`**: Date until which this data contract is effective. Refer to *../../type/basic.json#/definitions/dateTime*. Default: `None`.
- **`changeDescription`**: Change that led to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Incremental change description of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`sourceUrl`**: Source URL of the data contract. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`latestResult`** *(object)*: Latest validation result for this data contract. Cannot contain additional properties.
  - **`timestamp`**: Refer to *../../type/basic.json#/definitions/timestamp*.
  - **`status`**: Refer to *../../type/contractExecutionStatus.json*.
  - **`message`** *(string)*
  - **`resultId`**: Refer to *../../type/basic.json#/definitions/uuid*.
## Definitions

- **`contractStatus`** *(string)*: Status of the data contract. Must be one of: `['Draft', 'Active', 'Deprecated']`.
- **`contractUpdate`** *(object)*: Record of updates to the data contract. Cannot contain additional properties.
  - **`timestamp`**: Timestamp when the contract was updated. Refer to *../../type/basic.json#/definitions/timestamp*.
  - **`updatedBy`** *(string)*: User who updated the contract.
  - **`changeDescription`**: Description of changes made to the contract. Refer to *../../type/basic.json#/definitions/markdown*.
  - **`version`** *(string)*: Version number of the contract after the update.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
