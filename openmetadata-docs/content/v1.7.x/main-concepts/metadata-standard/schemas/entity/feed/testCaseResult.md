---
title: Test Case Result | OpenMetadata Test Results
slug: /main-concepts/metadata-standard/schemas/entity/feed/testcaseresult
---

# TestCaseResultFeedInfo

*This schema defines the schema for Test Case Result Updates for Feed.*

## Properties

- **`parameterValues`** *(array)*: Summary of test case execution.
  - **Items**: Refer to *[../../tests/testCase.json#/definitions/testCaseParameterValue](#/../tests/testCase.json#/definitions/testCaseParameterValue)*.
- **`entityTestResultSummary`** *(array)*: Summary of test case execution.
  - **Items**: Refer to *[../../tests/testSuite.json#/definitions/testSuiteConnection/resultSummary](#/../tests/testSuite.json#/definitions/testSuiteConnection/resultSummary)*.
- **`testCaseResult`** *(array)*: Test Case Result for last 7 days.
  - **Items**: Refer to *[../../tests/basic.json#/definitions/testCaseResult](#/../tests/basic.json#/definitions/testCaseResult)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
