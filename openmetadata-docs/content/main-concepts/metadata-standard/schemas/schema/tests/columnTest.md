---
title: columnTest
slug: /main-concepts/metadata-standard/schemas/schema/tests
---

# ColumnTest

*ColumnTest is a test definition to capture data quality tests against tables and columns.*

## Properties

- **`id`**: Unique identifier of this table instance. Refer to *../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this test case. Name passed by client will be  overridden by  auto generating based on table/column name and test name. Refer to *../type/basic.json#/definitions/entityName*.
- **`description`**: Description of the testcase. Refer to *../type/basic.json#/definitions/markdown*.
- **`columnName`** *(string)*: Name of the column in a table.
- **`testCase`**: Refer to *#/definitions/columnTestCase*.
- **`executionFrequency`**: Refer to *./basic.json#/definitions/testCaseExecutionFrequency*.
- **`results`** *(array)*: List of results of the test case.
  - **Items**: Refer to *./basic.json#/definitions/testCaseResult*.
- **`owner`**: Owner of this Pipeline. Refer to *../type/entityReference.json*. Default: `None`.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
## Definitions

- **`columnTestCase`** *(object)*: Column Test Case. Cannot contain additional properties.
  - **`config`**
  - **`columnTestType`**: Must be one of: `['columnValuesToBeUnique', 'columnValuesToBeNotNull', 'columnValuesToMatchRegex', 'columnValuesToBeNotInSet', 'columnValuesToBeInSet', 'columnValuesToBeBetween', 'columnValuesMissingCountToBeEqual', 'columnValueLengthsToBeBetween', 'columnValueMaxToBeBetween', 'columnValueMinToBeBetween', 'columnValuesSumToBeBetween', 'columnValuesToNotMatchRegex', 'columnValueStdDevToBeBetween', 'columnValueMedianToBeBetween', 'columnValueMeanToBeBetween']`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
