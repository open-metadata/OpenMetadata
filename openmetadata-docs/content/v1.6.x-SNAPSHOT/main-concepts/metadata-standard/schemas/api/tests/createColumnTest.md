---
title: createColumnTest
slug: /main-concepts/metadata-standard/schemas/api/tests/createcolumntest
---

# CreateColumnTestRequest

*ColumnTest is a test definition to capture data quality tests against tables and columns.*

## Properties

- **`description`**: Description of the testcase. Refer to *../../type/basic.json#/definitions/markdown*.
- **`columnName`** *(string)*: Name of the column in a table.
- **`testCase`**: Refer to *../../tests/columnTest.json#/definitions/columnTestCase*.
- **`executionFrequency`**: Refer to *../../tests/basic.json#/definitions/testCaseExecutionFrequency*.
- **`result`**: Refer to *../../tests/basic.json#/definitions/testCaseResult*.
- **`owner`**: Owner of this Pipeline. Refer to *../../type/entityReference.json*. Default: `None`.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
