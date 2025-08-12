---
title: basic
slug: /main-concepts/metadata-standard/schemas/tests/basic
---

# Basic

*This schema defines basic types that are used by other test schemas.*

## Definitions

- **`columnTestSummaryDefinition`** *(object)*: Schema to capture test case execution summary at the column level.
  - **`success`** *(integer)*: Number of test cases that passed.
  - **`failed`** *(integer)*: Number of test cases that failed.
  - **`aborted`** *(integer)*: Number of test cases that aborted.
  - **`queued`** *(integer)*: Number of test cases that are queued for execution.
  - **`total`** *(integer)*: Total number of test cases.
  - **`entityLink`**: Refer to *../type/basic.json#/definitions/entityLink*.
- **`testSummary`** *(object)*: Schema to capture test case execution summary.
  - **`success`** *(integer)*: Number of test cases that passed.
  - **`failed`** *(integer)*: Number of test cases that failed.
  - **`aborted`** *(integer)*: Number of test cases that aborted.
  - **`queued`** *(integer)*: Number of test cases that are queued for execution.
  - **`total`** *(integer)*: Total number of test cases.
  - **`columnTestSummary`** *(array)*
    - **Items**: Refer to *#/definitions/columnTestSummaryDefinition*.
- **`testResultValue`** *(object)*: Schema to capture test case result values.
  - **`name`** *(string)*: name of the value.
  - **`value`** *(string)*: test result value.
  - **`predictedValue`** *(string)*: predicted value.
- **`testCaseStatus`** *(string)*: Status of Test Case run. Must be one of: `['Success', 'Failed', 'Aborted', 'Queued']`.
- **`testCaseResult`** *(object)*: Schema to capture test case result.
  - **`id`**: Unique identifier of this failure instance. Refer to *../type/basic.json#/definitions/uuid*.
  - **`testCaseFQN`**: Fully qualified name of the test case. Refer to *../type/basic.json#/definitions/fullyQualifiedEntityName*.
  - **`timestamp`**: Data one which test case result is taken. Refer to *../type/basic.json#/definitions/timestamp*.
  - **`testCaseStatus`**: Status of Test Case run. Refer to *#/definitions/testCaseStatus*.
  - **`result`** *(string)*: Details of test case results.
  - **`sampleData`** *(string)*: sample data to capture rows/columns that didn't match the expressed testcase.
  - **`testResultValue`** *(array)*
    - **Items**: Refer to *#/definitions/testResultValue*.
  - **`passedRows`** *(integer)*: Number of rows that passed.
  - **`failedRows`** *(integer)*: Number of rows that failed.
  - **`passedRowsPercentage`** *(number)*: Percentage of rows that passed.
  - **`failedRowsPercentage`** *(number)*: Percentage of rows that failed.
  - **`incidentId`**: Incident State ID associated with this result. This association happens when the result is created, and will stay there even when the incident is resolved. Refer to *../type/basic.json#/definitions/uuid*.
  - **`maxBound`** *(number)*: Upper bound limit for the test case result as defined in the test definition.
  - **`minBound`** *(number)*: Lower bound limit for the test case result as defined in the test definition.
  - **`testCase`**: Test case that this result is for. Refer to *../type/entityReference.json*.
  - **`testDefinition`**: Test definition that this result is for. Refer to *../type/entityReference.json*.
- **`testSuiteExecutionFrequency`** *(string)*: How often the test case should run. Must be one of: `['Hourly', 'Daily', 'Weekly']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
