---
title: createTestCaseResult
slug: /main-concepts/metadata-standard/schemas/api/tests/createtestcaseresult
---

# CreateTestCaseResult

*Schema to create a new test case result .*

## Properties

- **`fqn`** *(string)*: Fqn of the test case against which this test case result is added.
- **`timestamp`**: Data one which test case result is taken. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`testCaseStatus`**: Status of Test Case run. Refer to *../../tests/basic.json#/definitions/testCaseStatus*.
- **`result`** *(string)*: Details of test case results.
- **`sampleData`** *(string)*: sample data to capture rows/columns that didn't match the expressed testcase.
- **`testResultValue`** *(array)*
  - **Items**: Refer to *../../tests/basic.json#/definitions/testResultValue*.
- **`passedRows`** *(integer)*: Number of rows that passed.
- **`failedRows`** *(integer)*: Number of rows that failed.
- **`passedRowsPercentage`** *(number)*: Percentage of rows that passed.
- **`failedRowsPercentage`** *(number)*: Percentage of rows that failed.
- **`incidentId`**: Incident State ID associated with this result. This association happens when the result is created, and will stay there even when the incident is resolved. Refer to *../../type/basic.json#/definitions/uuid*.
- **`maxBound`** *(number)*: Upper bound limit for the test case result as defined in the test definition.
- **`minBound`** *(number)*: Lower bound limit for the test case result as defined in the test definition.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
