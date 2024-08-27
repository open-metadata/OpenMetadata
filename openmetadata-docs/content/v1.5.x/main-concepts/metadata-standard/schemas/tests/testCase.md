---
title: testCase
slug: /main-concepts/metadata-standard/schemas/tests/testcase
---

# TestCase

*Test case is a test definition to capture data quality tests against tables, columns, and other data assets.*

## Properties

- **`id`**: Unique identifier of this table instance. Refer to *../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this test case. Refer to *../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this test.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of the testcase. Refer to *../type/basic.json#/definitions/markdown*.
- **`testDefinition`**: Refer to *../type/entityReference.json*.
- **`entityLink`**: Refer to *../type/basic.json#/definitions/entityLink*.
- **`entityFQN`** *(string)*
- **`testSuite`**: Refer to *../type/entityReference.json*.
- **`testSuites`** *(array)*
  - **Items**: Refer to *./testSuite.json*.
- **`parameterValues`** *(array)*
  - **Items**: Refer to *#/definitions/testCaseParameterValue*.
- **`testCaseResult`**: Refer to *./basic.json#/definitions/testCaseResult*.
- **`version`**: Metadata version of the entity. Refer to *../type/entityHistory.json#/definitions/entityVersion*.
- **`owner`**: Owner of this Pipeline. Refer to *../type/entityReference.json*. Default: `None`.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`testCaseParameterValue`** *(object)*: This schema defines the parameter values that can be passed for a Test Case.
  - **`name`** *(string)*: name of the parameter. Must match the parameter names in testCaseParameterDefinition.
  - **`value`** *(string)*: value to be passed for the Parameters. These are input from Users. We capture this in string and convert during the runtime.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
