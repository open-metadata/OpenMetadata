---
title: basic
slug: /main-concepts/metadata-standard/schemas/tests/basic
---

# Basic

*This schema defines basic types that are used by other test schemas.*

## Definitions

- **`testSummary`** *(object)*: Schema to capture test case execution summary.
  - **`success`** *(integer)*: Number of test cases that passed.
  - **`failed`** *(integer)*: Number of test cases that failed.
  - **`aborted`** *(integer)*: Number of test cases that aborted.
  - **`total`** *(integer)*: Total number of test cases.
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
  - **`testCaseFailureStatus`** *(object)*: Schema to capture test case result.
    - **`testCaseFailureStatusType`** *(string)*: Status of Test Case Acknowledgement. Must be one of: `['Ack', 'New', 'Resolved']`.
    - **`testCaseFailureReason`** *(string)*: Reason of Test Case resolution. Must be one of: `['FalsePositive', 'MissingData', 'Duplicates', 'OutOfBounds', 'Other']`.
    - **`testCaseFailureComment`** *(string)*: Test case failure resolution comment.
    - **`updatedBy`** *(string)*: User who updated the test case failure status.
    - **`updatedAt`**: Time when test case failure status was updated. Refer to *../type/basic.json#/definitions/timestamp*.
- **`testSuiteExecutionFrequency`** *(string)*: How often the test case should run. Must be one of: `['Hourly', 'Daily', 'Weekly']`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
