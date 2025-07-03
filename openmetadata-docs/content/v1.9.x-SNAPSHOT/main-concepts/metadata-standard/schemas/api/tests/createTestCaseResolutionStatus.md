---
title: createTestCaseResolutionStatus
slug: /main-concepts/metadata-standard/schemas/api/tests/createtestcaseresolutionstatus
---

# CreateTestCaseResolutionStatus

*Schema to create a new test case result resolution status.*

## Properties

- **`testCaseResolutionStatusType`**: Status of Test Case. Refer to *[../../tests/testCaseResolutionStatus.json#/definitions/testCaseResolutionStatusTypes](#/../tests/testCaseResolutionStatus.json#/definitions/testCaseResolutionStatusTypes)*.
- **`testCaseResolutionStatusDetails`**: Details of the test case failure status. Default: `null`.
  - **One of**
    - : Refer to *[../../tests/resolved.json](#/../tests/resolved.json)*.
    - : Refer to *[../../tests/assigned.json](#/../tests/assigned.json)*.
- **`testCaseReference`**: Test case reference FQN. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`severity`**: Severity failure for the test associated with the resolution. Refer to *[../../tests/testCaseResolutionStatus.json#/definitions/severities](#/../tests/testCaseResolutionStatus.json#/definitions/severities)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
