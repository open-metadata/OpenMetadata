---
title: basic
slug: /main-concepts/metadata-standard/schemas/tests/basic
---

# Basic

*This schema defines basic types that are used by other test schemas.*

## Definitions

- **`testCaseResult`** *(object)*: Schema to capture test case result. Cannot contain additional properties.
  - **`executionTime`**: Data one which profile is taken. Refer to *../type/basic.json#/definitions/timestamp*.
  - **`testCaseStatus`** *(string)*: Status of Test Case run. Must be one of: `['Success', 'Failed', 'Aborted']`.
  - **`result`** *(string)*: Details of test case results.
  - **`sampleData`** *(string)*: sample data to capture rows/columns that didn't match the expressed testcase.
- **`testCaseExecutionFrequency`** *(string)*: How often the test case should run. Must be one of: `['Hourly', 'Daily', 'Weekly']`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
