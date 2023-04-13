---
title: basic
slug: /main-concepts/metadata-standard/schemas/tests/basic
---

# Basic

*This schema defines basic types that are used by other test schemas.*

## Definitions

- **`testResultValue`** *(object)*: Schema to capture test case result values.
  - **`name`** *(string)*: name of the value.
  - **`value`** *(string)*: test result value.
- **`testCaseStatus`** *(string)*: Status of Test Case run. Must be one of: `['Success', 'Failed', 'Aborted']`.
- **`testCaseResult`** *(object)*: Schema to capture test case result. Cannot contain additional properties.
  - **`timestamp`**: Data one which test case result is taken. Refer to *../type/basic.json#/definitions/timestamp*.
  - **`testCaseStatus`**: Status of Test Case run. Refer to *#/definitions/testCaseStatus*.
  - **`result`** *(string)*: Details of test case results.
  - **`sampleData`** *(string)*: sample data to capture rows/columns that didn't match the expressed testcase.
  - **`testResultValue`** *(array)*
    - **Items**: Refer to *#/definitions/testResultValue*.
- **`testSuiteExecutionFrequency`** *(string)*: How often the test case should run. Must be one of: `['Hourly', 'Daily', 'Weekly']`.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
