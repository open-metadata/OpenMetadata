---
title: Data Quality & Observability
---

# Data Quality & Observability

## Table of contents
[[toc]]

---

## Summary

| Metric | Count |
|--------|-------|
| **Test Files** | 6 |
| **Test Cases** | 13 |
| **Test Steps** | 45 |
| **Total Scenarios** | 58 |

---

## DataQualityAndProfiler

📁 **File:** [`src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 4 |
| Steps | 18 |

### Standalone Tests

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Table test case | Table test case | 4 | [L125](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L125) |
| | ↳ *Create* | | | [L140](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L140) |
| | ↳ *Edit* | | | [L197](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L197) |
| | ↳ *Redirect to IncidentPage and verify breadcrumb* | | | [L276](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L276) |
| | ↳ *Delete* | | | [L287](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L287) |
| 2 | Column test case | Column test case | 9 | [L292](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L292) |
| | ↳ *Create* | | | [L310](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L310) |
| | ↳ *Edit* | | | [L376](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L376) |
| | ↳ *Redirect to IncidentPage and verify breadcrumb* | | | [L447](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L447) |
| | ↳ *Delete* | | | [L458](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L458) |
| | ↳ *Array params value should be visible while editing the test case* | | | [L568](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L568) |
| | ↳ *Validate patch request for edit test case* | | | [L595](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L595) |
| | ↳ *Update test case display name from Data Quality page* | | | [L698](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L698) |
| | ↳ *Update profiler setting* | | | [L767](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L767) |
| | ↳ *Reset profile sample type* | | | [L843](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L843) |
| 3 | TestCase filters | TestCase filters | - | [L901](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L901) |
| 4 | Pagination functionality in test cases list | Pagination functionality in test cases list | 5 | [L1317](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L1317) |
| | ↳ *Verify pagination controls are visible* | | | [L1349](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L1349) |
| | ↳ *Verify first page state* | | | [L1358](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L1358) |
| | ↳ *Navigate to next page* | | | [L1366](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L1366) |
| | ↳ *Navigate back to previous page* | | | [L1379](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L1379) |
| | ↳ *Test page size dropdown* | | | [L1392](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L1392) |

---


## IncidentManager

📁 **File:** [`src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 5 |
| Steps | 16 |

### Incident Manager

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Complete Incident lifecycle with table owner | Complete Incident lifecycle with table owner | 7 | [L108](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L108) |
| | ↳ *Claim ownership of table* | | | [L119](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L119) |
| | ↳ *Acknowledge table test case* | | | [L144](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L144) |
| | ↳ *Assign incident to user* | | | [L152](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L152) |
| | ↳ *Re-assign incident to user* | | | [L161](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L161) |
| | ↳ *Verify that notifications correctly display mentions for the incident manager* | | | [L216](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L216) |
| | ↳ *Re-assign incident from test case page* | | | [L237](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L237) |
| | ↳ *Resolve incident* | | | [L257](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L257) |
| 2 | Resolving incident & re-run pipeline | Resolving incident & re-run pipeline | 5 | [L273](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L273) |
| | ↳ *Acknowledge table test case* | | | [L279](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L279) |
| | ↳ *Resolve task from incident list page* | | | [L287](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L287) |
| | ↳ *Task should be closed* | | | [L327](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L327) |
| | ↳ *Re-run pipeline* | | | [L351](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L351) |
| | ↳ *Verify open and closed task* | | | [L359](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L359) |
| 3 | Rerunning pipeline for an open incident | Rerunning pipeline for an open incident | 4 | [L378](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L378) |
| | ↳ *Ack incident and verify open task* | | | [L388](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L388) |
| | ↳ *Assign incident to user* | | | [L404](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L404) |
| | ↳ *Re-run pipeline* | | | [L412](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L412) |
| | ↳ *Verify incident* | | | [L420](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L420) |
| 4 | Validate Incident Tab in Entity details page | Validate Incident Tab in Entity details page | - | [L437](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L437) |
| 5 | Verify filters in Incident Manager | Filters in Incident Manager | - | [L485](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L485) |

---


## TestSuite

📁 **File:** [`src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 8 |

### Standalone Tests

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Logical TestSuite | Logical TestSuite | 8 | [L52](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts#L52) |
| | ↳ *Create* | | | [L71](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts#L71) |
| | ↳ *Domain Add, Update and Remove* | | | [L101](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts#L101) |
| | ↳ *User as Owner assign, update & delete for test suite* | | | [L107](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts#L107) |
| | ↳ *Add test case to logical test suite by owner* | | | [L132](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts#L132) |
| | ↳ *Add test suite pipeline* | | | [L161](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts#L161) |
| | ↳ *Remove test case from logical test suite by owner* | | | [L190](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts#L190) |
| | ↳ *Test suite filters* | | | [L210](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts#L210) |
| | ↳ *Delete test suite by owner* | | | [L256](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts#L256) |

---


## ProfilerConfigurationPage

📁 **File:** [`src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 2 |
| Steps | 3 |

### Profiler Configuration Page

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Admin user | Admin user | 3 | [L56](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts#L56) |
| | ↳ *Verify validation* | | | [L65](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts#L65) |
| | ↳ *Update profiler configuration* | | | [L77](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts#L77) |
| | ↳ *Remove Configuration* | | | [L141](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts#L141) |
| 2 | Non admin user | Non admin user | - | [L158](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts#L158) |

---


## TestSuitePipelineRedeploy

📁 **File:** [`src/main/resources/ui/playwright/e2e/Features/TestSuitePipelineRedeploy.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TestSuitePipelineRedeploy.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |

### Bulk Re-Deploy pipelines 

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Re-deploy all test-suite ingestion pipelines | Re-deploy all test-suite ingestion pipelines | - | [L53](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TestSuitePipelineRedeploy.spec.ts#L53) |

---


## TestSuiteMultiPipeline

📁 **File:** [`src/main/resources/ui/playwright/e2e/Features/TestSuiteMultiPipeline.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TestSuiteMultiPipeline.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 0 |
| Steps | 0 |

---

