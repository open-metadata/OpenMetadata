---
title: testConnectionDefinition
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/testconnectiondefinition
---

# TestConnectionDefinition

*TestConnection is the definition that will encapsulate the steps required to test a connection to a specific service.*

## Properties

- **`id`**: Unique identifier of this test case definition instance. Refer to *../../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of the Test Connection Definition. It should be the `type` of the service being tested, e.g., Mysql, or Snowflake. Refer to *../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this test definition.
- **`description`**: Description of the test connection def. Refer to *../../../type/basic.json#/definitions/markdown*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`steps`** *(array)*: Steps to test the connection. Order matters.
  - **Items**: Refer to *#/definitions/testConnectionStep*.
- **`owners`**: Owner of this TestConnection definition. Refer to *../../../type/entityReferenceList.json*. Default: `None`.
- **`version`**: Metadata version of the entity. Refer to *../../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`domains`**: Domains the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *../../../type/entityReferenceList.json*.
## Definitions

- **`testConnectionStep`** *(object)*: Function that tests one specific element of the service. E.g., listing schemas, lineage, or tags. Cannot contain additional properties.
  - **`name`** *(string)*: Name of the step being tested.
  - **`description`** *(string)*: What is the goal of the step.
  - **`errorMessage`** *(string)*: In case of error this message should be displayed on UI, We define this message manually on test connection definition.
  - **`mandatory`** *(boolean)*: Is this step mandatory to be passed? Default: `True`.
  - **`shortCircuit`** *(boolean)*: This field if set to true, indicates that the step is important enough to break the process in case of failure. Default: `False`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
