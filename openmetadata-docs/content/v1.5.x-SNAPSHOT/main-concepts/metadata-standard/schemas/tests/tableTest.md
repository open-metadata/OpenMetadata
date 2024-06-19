---
title: tableTest
slug: /main-concepts/metadata-standard/schemas/tests/tabletest
---

# TableTest

*TableTest is a test definition to capture data quality tests against tables and columns.*

## Properties

- **`id`**: Unique identifier of this table instance. Refer to *../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this test case. Refer to *../type/basic.json#/definitions/entityName*.
- **`description`**: Description of the testcase. Refer to *../type/basic.json#/definitions/markdown*.
- **`testCase`**: Refer to *#/definitions/tableTestCase*.
- **`executionFrequency`**: Refer to *./basic.json#/definitions/testCaseExecutionFrequency*.
- **`results`** *(array)*: List of results of the test case.
  - **Items**: Refer to *./basic.json#/definitions/testCaseResult*.
- **`owner`**: Owner of this Pipeline. Refer to *../type/entityReference.json*. Default: `None`.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
## Definitions

- **`tableTestCase`** *(object)*: Table Test Case. Cannot contain additional properties.
  - **`config`**
  - **`tableTestType`**: Must be one of: `['tableRowCountToEqual', 'tableRowCountToBeBetween', 'tableColumnCountToEqual', 'tableColumnCountToBeBetween', 'tableColumnToMatchSet', 'tableColumnNameToExist', 'tableCustomSQLQuery']`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
