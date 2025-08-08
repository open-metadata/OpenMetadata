---
title: testCaseResult
slug: /main-concepts/metadata-standard/schemas/entity/feed/testcaseresult
---

# TestCaseResultFeedInfo

*This schema defines the schema for Test Case Result Updates for Feed.*

## Properties

- **`parameterValues`** *(array)*: Summary of test case execution.
  - **Items**: Refer to *../../tests/testCase.json#/definitions/testCaseParameterValue*.
- **`entityTestResultSummary`** *(array)*: Summary of test case execution.
  - **Items**: Refer to *../../tests/testSuite.json#/definitions/testSuiteConnection/resultSummary*.
- **`testCaseResult`** *(array)*: Test Case Result for last 7 days.
  - **Items**: Refer to *../../tests/basic.json#/definitions/testCaseResult*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
