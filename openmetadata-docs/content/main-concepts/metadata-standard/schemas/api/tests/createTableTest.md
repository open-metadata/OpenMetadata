---
title: createTableTest
slug: /main-concepts/metadata-standard/schemas/api/tests/createtabletest
---

# CreateTableTestRequest

*TableTest is a test definition to capture data quality tests against tables and columns.*

## Properties

- **`description`**: Description of the testcase. Refer to *../../type/basic.json#/definitions/markdown*.
- **`testCase`**: Refer to *../../tests/tableTest.json#/definitions/tableTestCase*.
- **`executionFrequency`**: Refer to *../../tests/basic.json#/definitions/testCaseExecutionFrequency*.
- **`result`**: Refer to *../../tests/basic.json#/definitions/testCaseResult*.
- **`owner`**: Owner of this Pipeline. Refer to *../../type/entityReference.json*. Default: `None`.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
