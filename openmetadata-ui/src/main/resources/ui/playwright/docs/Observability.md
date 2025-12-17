[🏠 Home](./README.md) > **Observability**

# Observability

> **4 Components** | **9 Files** | **35 Tests**

## Table of Contents
- [Data Quality](#data-quality)
- [Incident Manager](#incident-manager)
- [Alerts & Notifications](#alerts-notifications)
- [Profiler](#profiler)

---

<div id="data-quality"></div>

## Data Quality

<details open>
<summary>📄 <b>DataQualityAndProfiler.spec.ts</b> (7 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Table test case | Table test case |
| 2 | Column test case | Column test case |
| 3 | Profiler matrix and test case graph should visible for admin, data consumer and data steward | Profiler matrix and test case graph should visible for admin, data consumer and data steward |
| 4 | TestCase with Array params value | TestCase with Array params value |
| 5 | Update profiler setting modal | Update profiler setting modal |
| 6 | TestCase filters | TestCase filters |
| 7 | Pagination functionality in test cases list | Pagination functionality in test cases list |

</details>

<details open>
<summary>📄 <b>AddTestCaseNewFlow.spec.ts</b> (4 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts)

### Add TestCase New Flow

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Add TestCase New Flow** - Add Table Test Case | Add Table Test Case |
| 2 | **Add TestCase New Flow** - Add Column Test Case | Add Column Test Case |
| 3 | **Add TestCase New Flow** - Add multiple test case from table details page and validate pipeline | Add multiple test case from table details page and validate pipeline |
| 4 | **Add TestCase New Flow** - Non-owner user should not able to add test case | Non-owner user should not able to add test case |

</details>

<details open>
<summary>📄 <b>TestCases.spec.ts</b> (3 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/TestCases.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestCases.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Table difference test case | Table difference test case |
| 2 | Custom SQL Query | Custom SQL Query |
| 3 | Column Values To Be Not Null | Column Values To Be Not Null |

</details>

<details open>
<summary>📄 <b>TestSuite.spec.ts</b> (1 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Logical TestSuite | Logical TestSuite |

</details>

<details open>
<summary>📄 <b>TestCaseVersionPage.spec.ts</b> (1 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts)

### TestCase Version Page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **TestCase Version Page** - should show the test case version page | Show the test case version page |

</details>


---

<div id="incident-manager"></div>

## Incident Manager

<details open>
<summary>📄 <b>IncidentManager.spec.ts</b> (5 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts)

### Incident Manager

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Incident Manager** - Complete Incident lifecycle with table owner | Complete Incident lifecycle with table owner |
| 2 | **Incident Manager** - Resolving incident & re-run pipeline | Resolving incident & re-run pipeline |
| 3 | **Incident Manager** - Rerunning pipeline for an open incident | Rerunning pipeline for an open incident |
| 4 | **Incident Manager** - Validate Incident Tab in Entity details page | Validate Incident Tab in Entity details page |
| 5 | **Incident Manager** - Verify filters in Incident Manager's page | Filters in Incident Manager's page |

</details>


---

<div id="alerts-notifications"></div>

## Alerts & Notifications

<details open>
<summary>📄 <b>NotificationAlerts.spec.ts</b> (6 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Single Filter Alert | Single Filter Alert |
| 2 | Multiple Filters Alert | Multiple Filters Alert |
| 3 | Task source alert | Task source alert |
| 4 | Conversation source alert | Conversation source alert |
| 5 | Alert operations for a user with and without permissions | Alert operations for a user with and without permissions |
| 6 | destination should work properly | Destination should work properly |

</details>

<details open>
<summary>📄 <b>ObservabilityAlerts.spec.ts</b> (6 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/ObservabilityAlerts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ObservabilityAlerts.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Pipeline Alert | Pipeline Alert |
| 2 | Table alert | Table alert |
| 3 | Ingestion Pipeline alert | Ingestion Pipeline alert |
| 4 | Test case alert | Case alert |
| 5 | Test Suite alert | Suite alert |
| 6 | Alert operations for a user with and without permissions | Alert operations for a user with and without permissions |

</details>


---

<div id="profiler"></div>

## Profiler

<details open>
<summary>📄 <b>ProfilerConfigurationPage.spec.ts</b> (2 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts)

### Profiler Configuration Page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Profiler Configuration Page** - Admin user | Admin user |
| 2 | **Profiler Configuration Page** - Non admin user | Non admin user |

</details>


---

