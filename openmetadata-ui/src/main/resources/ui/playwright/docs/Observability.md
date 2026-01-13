[🏠 Home](./README.md) > **Observability**

# Observability

> **4 Components** | **13 Files** | **61 Tests** | **180 Scenarios** 🚀

## Table of Contents
- [Data Quality](#data-quality)
- [Incident Manager](#incident-manager)
- [Alerts & Notifications](#alerts-notifications)
- [Profiler](#profiler)

---

<div id="data-quality"></div>

## Data Quality

<details open>
<summary>📄 <b>ColumnLevelTests.spec.ts</b> (16 tests, 48 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DataQuality/ColumnLevelTests.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/ColumnLevelTests.spec.ts)

### Column Level Data Quality Test Cases

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Column Level Data Quality Test Cases** - Column Values To Be Not Null | Column Values To Be Not Null test case  Creates a column-level `columnValuesToBeNotNull` test for a numeric column with description; verifies, edits display name and description, and deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and description; submit; verify visibility in Data Quality tab. 3. Edit display name and description; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 2 | **Column Level Data Quality Test Cases** - Column Values To Be Between | Column Values To Be Between test case  Creates a `columnValuesToBeBetween` test for a numeric column with min and max values; verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and min/max values; submit; verify visibility in Data Quality tab. 3. Edit min/max values; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 3 | **Column Level Data Quality Test Cases** - Column Values To Be Unique | Column Values To Be Unique test case  Creates a `columnValuesToBeUnique` test for a column to verify all values are unique; verifies visibility in the Data Quality tab, edits display name, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name; submit; verify visibility in Data Quality tab. 3. Edit display name; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 4 | **Column Level Data Quality Test Cases** - Column Values To Be In Set | Column Values To Be In Set test case  Creates a `columnValuesToBeInSet` test to verify column values are within allowed set; verifies visibility in the Data Quality tab, edits the allowed values, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and allowed values array; submit; verify visibility in Data Quality tab. 3. Edit allowed values; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 5 | **Column Level Data Quality Test Cases** - Column Values To Be Not In Set | Column Values To Be Not In Set test case  Creates a `columnValuesToBeNotInSet` test to verify column values are NOT in forbidden set; verifies visibility in the Data Quality tab, edits the forbidden values, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and forbidden values array; submit; verify visibility in Data Quality tab. 3. Edit forbidden values; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 6 | **Column Level Data Quality Test Cases** - Column Values To Match Regex | Column Values To Match Regex test case  Creates a `columnValuesToMatchRegex` test to verify column values match a regex pattern; verifies visibility in the Data Quality tab, edits the regex pattern, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and regex pattern; submit; verify visibility in Data Quality tab. 3. Edit regex pattern; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 7 | **Column Level Data Quality Test Cases** - Column Values To Not Match Regex | Column Values To Not Match Regex test case  Creates a `columnValuesToNotMatchRegex` test to verify column values do NOT match a regex pattern; verifies visibility in the Data Quality tab, edits the regex pattern, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and regex pattern; submit; verify visibility in Data Quality tab. 3. Edit regex pattern; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 8 | **Column Level Data Quality Test Cases** - Column Value Max To Be Between | Column Value Max To Be Between test case  Creates a `columnValueMaxToBeBetween` test to verify maximum value in column is between range; verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and min/max for max value; submit; verify visibility in Data Quality tab. 3. Edit range values; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 9 | **Column Level Data Quality Test Cases** - Column Value Min To Be Between | Column Value Min To Be Between test case  Creates a `columnValueMinToBeBetween` test to verify minimum value in column is between range; verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and min/max for min value; submit; verify visibility in Data Quality tab. 3. Edit range values; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 10 | **Column Level Data Quality Test Cases** - Column Value Mean To Be Between | Column Value Mean To Be Between test case  Creates a `columnValueMeanToBeBetween` test to verify mean value of column is between range; verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and min/max for mean value; submit; verify visibility in Data Quality tab. 3. Edit range values; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 11 | **Column Level Data Quality Test Cases** - Column Value Median To Be Between | Column Value Median To Be Between test case  Creates a `columnValueMedianToBeBetween` test to verify median value of column is between range; verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and min/max for median value; submit; verify visibility in Data Quality tab. 3. Edit range values; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 12 | **Column Level Data Quality Test Cases** - Column Value StdDev To Be Between | Column Value StdDev To Be Between test case  Creates a `columnValueStdDevToBeBetween` test to verify standard deviation of column is between range; verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and min/max for std dev value; submit; verify visibility in Data Quality tab. 3. Edit range values; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 13 | **Column Level Data Quality Test Cases** - Column Values Sum To Be Between | Column Values Sum To Be Between test case  Creates a `columnValuesSumToBeBetween` test to verify sum of column values is between range; verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and min/max for sum value; submit; verify visibility in Data Quality tab. 3. Edit range values; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 14 | **Column Level Data Quality Test Cases** - Column Values Length To Be Between | Column Values Length To Be Between test case  Creates a `columnValuesLengthToBeBetween` test to verify string lengths in column are between range; verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and min/max length values; submit; verify visibility in Data Quality tab. 3. Edit range values; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 15 | **Column Level Data Quality Test Cases** - Column Values Missing Count To Be Equal | Column Values Missing Count To Be Equal test case  Creates a `columnValuesMissingCount` test to verify missing/null count equals expected value; verifies visibility in the Data Quality tab, edits the missing count value, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name and missing count value; submit; verify visibility in Data Quality tab. 3. Edit missing count value; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 16 | **Column Level Data Quality Test Cases** - Column Value To Be At Expected Location | Column Value To Be At Expected Location test case  Creates a `columnValuesToBeAtExpectedLocation` test to verify a value at a specific row location; verifies visibility in the Data Quality tab, edits the expected value and row, and finally deletes the test case. Steps 1. From entity page, open create test case (Column Level), select column and definition. 2. Fill name, expected value, and row number; submit; verify visibility in Data Quality tab. 3. Edit expected value and row number; delete the test case. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |

</details>

<details open>
<summary>📄 <b>TableLevelTests.spec.ts</b> (9 tests, 27 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DataQuality/TableLevelTests.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/TableLevelTests.spec.ts)

### Table Level Data Quality Test Cases

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table Level Data Quality Test Cases** - Table Row Count To Be Between | Table Row Count To Be Between test case  Creates a `tableRowCountToBeBetween` test with min and max row count values; verifies visibility in the Data Quality tab, edits the threshold values, and finally deletes the test case. Steps 1. Navigate to entity → Data Observability → Table Profile. 2. Open Test Case form, select type `tableRowCountToBeBetween`, set min and max values. 3. Submit and verify in Data Quality tab; then edit threshold values; delete at the end. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 2 | **Table Level Data Quality Test Cases** - Table Row Count To Equal | Table Row Count To Equal test case  Creates a `tableRowCountToEqual` test with an exact row count value; verifies visibility in the Data Quality tab, edits the value, and finally deletes the test case. Steps 1. Navigate to entity → Data Observability → Table Profile. 2. Open Test Case form, select type `tableRowCountToEqual`, set exact row count value. 3. Submit and verify in Data Quality tab; then edit the value; delete at the end. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 3 | **Table Level Data Quality Test Cases** - Table Column Count To Be Between | Table Column Count To Be Between test case  Creates a `tableColumnCountToBeBetween` test with min and max column count values; verifies visibility in the Data Quality tab, edits the threshold values, and finally deletes the test case. Steps 1. Navigate to entity → Data Observability → Table Profile. 2. Open Test Case form, select type `tableColumnCountToBeBetween`, set min and max values. 3. Submit and verify in Data Quality tab; then edit threshold values; delete at the end. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 4 | **Table Level Data Quality Test Cases** - Table Column Count To Equal | Table Column Count To Equal test case  Creates a `tableColumnCountToEqual` test with an exact column count value; verifies visibility in the Data Quality tab, edits the value, and finally deletes the test case. Steps 1. Navigate to entity → Data Observability → Table Profile. 2. Open Test Case form, select type `tableColumnCountToEqual`, set exact column count value. 3. Submit and verify in Data Quality tab; then edit the value; delete at the end. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 5 | **Table Level Data Quality Test Cases** - Table Column Name To Exist | Table Column Name To Exist test case  Creates a `tableColumnNameToExist` test to verify a column exists; verifies visibility in the Data Quality tab, edits the column name, and finally deletes the test case. Steps 1. Navigate to entity → Data Observability → Table Profile. 2. Open Test Case form, select type `tableColumnNameToExist`, set column name. 3. Submit and verify in Data Quality tab; then edit the column name; delete at the end. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 6 | **Table Level Data Quality Test Cases** - Table Column To Match Set | Table Column To Match Set test case  Creates a `tableColumnToMatchSet` test to verify columns match expected set; verifies visibility in the Data Quality tab, edits the column names, and finally deletes the test case. Steps 1. Navigate to entity → Data Observability → Table Profile. 2. Open Test Case form, select type `tableColumnToMatchSet`, set column names array. 3. Submit and verify in Data Quality tab; then edit the column names; delete at the end. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 7 | **Table Level Data Quality Test Cases** - Table Difference | Table Difference test case  Creates a `tableDiff` test by selecting a second table, setting key columns, use columns, and threshold; verifies visibility in the Data Quality tab, edits to add more columns, and finally deletes the test case. Steps 1. Navigate to entity → Data Observability → Table Profile. 2. Open Test Case form, select type `tableDiff`, pick Table 2 and its key columns; define Table 1 key/use columns and threshold. 3. Submit and verify in Data Quality tab; then edit to add additional key/use columns; delete at the end. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 8 | **Table Level Data Quality Test Cases** - Custom SQL Query | Custom SQL Query test case  Creates a `tableCustomSQLQuery` test with SQL in CodeMirror, selects strategy and threshold; verifies, edits display name, SQL and strategy, updates threshold, and deletes the test case. Steps 1. Navigate to entity → Data Observability → Table Profile. 2. Open Test Case form, select `tableCustomSQLQuery`, input SQL, choose strategy (ROWS/COUNT), set threshold. 3. Submit and verify in Data Quality tab; then edit display name, SQL and strategy; delete at the end. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |
| 9 | **Table Level Data Quality Test Cases** - Table Row Inserted Count To Be Between | Table Row Inserted Count To Be Between test case  Creates a `tableRowInsertedCountToBeBetween` test with min and max inserted row count values; verifies visibility in the Data Quality tab, edits the threshold values, and finally deletes the test case. Steps 1. Navigate to entity → Data Observability → Table Profile. 2. Open Test Case form, select type `tableRowInsertedCountToBeBetween`, set min and max values. 3. Submit and verify in Data Quality tab; then edit threshold values; delete at the end. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Delete* | |

</details>

<details open>
<summary>📄 <b>AddTestCaseNewFlow.spec.ts</b> (4 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts)

### Add TestCase New Flow

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Add TestCase New Flow** - Add Table Test Case | Tests creating a table-level test case  Creates a table-row-count Equals test case from the Data Quality page and verifies the test entity and associated pipeline visibility. Steps 1. Open the test case form and select a table via indexed search. 2. Fill the test name, select "table row count to equal", set params, and submit. 3. Assert that TestSuite pipeline creation call occurs and the created test case is visible on the entity page. |
| | ↳ *Create table-level test case* | |
| | ↳ *Validate test case in Entity Page* | |
| 2 | **Add TestCase New Flow** - Add Column Test Case | Tests creating a column-level test case  Creates a Column Values To Be Unique test case from the Data Quality page and validates the created test entity and test suite pipeline. Steps 1. Open the test case form, switch to Column Level, select table and a column. 2. Fill test metadata and submit the form. 3. Verify the created test displays on the entity page and pipeline tab shows the TestSuite pipeline. |
| | ↳ *Create column-level test case* | |
| | ↳ *Validate test case in Entity Page* | |
| 3 | **Add TestCase New Flow** - Add multiple test case from table details page and validate pipeline | Tests bulk creation from entity page and pipeline validation  Adds a table-level and a column-level test case from the table details page and verifies test counts and the TestSuite pipeline, including edit navigation. Steps 1. From the table details page, add a table-level test case. 2. Add a column-level test case (scheduler card hidden; verify no pipeline POST). 3. Assert test count is 2 and pipeline count is 1; open pipeline list and navigate to edit. |
| 4 | **Add TestCase New Flow** - Non-owner user should not able to add test case | Tests permission enforcement for non-owner roles  Validates that Data Consumer and Data Steward roles cannot create test cases and see the correct form validation message. Steps 1. As Data Consumer and Data Steward, open the create test case form. 2. Select a table and attempt to submit. 3. Verify the form helper shows lack-of-permission message and creation is blocked. |

</details>

<details open>
<summary>📄 <b>TestSuiteMultiPipeline.spec.ts</b> (2 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/TestSuiteMultiPipeline.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TestSuiteMultiPipeline.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | TestSuite multi pipeline support | Create, update, and delete a TestSuite pipeline from the entity page  Creates a test case, configures and deploys a weekly TestSuite pipeline, updates the schedule, and finally deletes pipelines to validate the empty state and action CTA visibility. |
| | ↳ *Create a new pipeline* | |
| | ↳ *Update the pipeline* | |
| | ↳ *Delete the pipeline* | |
| 2 | Edit the pipeline's test case | Edit the pipeline's test cases  Creates multiple test cases and a TestSuite pipeline, edits the pipeline to unselect a test case, deploys the change, and verifies the persisted selection on re-open. |

</details>

<details open>
<summary>📄 <b>Dimensionality.spec.ts</b> (1 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DataQuality/Dimensionality.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/Dimensionality.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Dimensionality Tests | Dimensionality Tests  Creates a dimension-level test case, edits dimension columns, and validates the dimension selector in the details view. |
| | ↳ *Add dimensionality test case* | |
| | ↳ *Edit dimensionality from entity page* | |
| | ↳ *Details page should show updated dimensions* | |

</details>

<details open>
<summary>📄 <b>TestSuitePipelineRedeploy.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/TestSuitePipelineRedeploy.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TestSuitePipelineRedeploy.spec.ts)

### Bulk Re-Deploy pipelines 

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Bulk Re-Deploy pipelines ** - Re-deploy all test-suite ingestion pipelines | Re-deploy all TestSuite ingestion pipelines  Navigates to Data Observability settings, selects multiple pipelines, triggers bulk redeploy, and verifies success confirmation. |

</details>

<details open>
<summary>📄 <b>TestSuite.spec.ts</b> (1 tests, 8 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Logical TestSuite | Logical TestSuite |
| | ↳ *Create* | |
| | ↳ *Domain Add, Update and Remove* | |
| | ↳ *User as Owner assign, update & delete for test suite* | |
| | ↳ *Add test case to logical test suite by owner* | |
| | ↳ *Add test suite pipeline* | |
| | ↳ *Remove test case from logical test suite by owner* | |
| | ↳ *Test suite filters* | |
| | ↳ *Delete test suite by owner* | |

</details>

<details open>
<summary>📄 <b>TestCaseVersionPage.spec.ts</b> (1 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts)

### TestCase Version Page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **TestCase Version Page** - should show the test case version page | View and verify Test Case version changes  Opens the Test Case details, performs sequential edits, and verifies version bumps with diffs. |
| | ↳ *Display name change* | |
| | ↳ *Description change* | |
| | ↳ *Parameter change* | |

</details>


---

<div id="incident-manager"></div>

## Incident Manager

<details open>
<summary>📄 <b>IncidentManager.spec.ts</b> (5 tests, 18 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts)

### Incident Manager

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Incident Manager** - Complete Incident lifecycle with table owner | Complete incident lifecycle with table owner  Claims table ownership, acknowledges a failed test case, assigns and reassigns the incident, validates notifications for mentions, and resolves the incident. |
| | ↳ *Claim ownership of table* | |
| | ↳ *Acknowledge table test case's failure* | |
| | ↳ *Assign incident to user* | |
| | ↳ *Re-assign incident to user* | |
| | ↳ *Verify that notifications correctly display mentions for the incident manager* | |
| | ↳ *Re-assign incident from test case page's header* | |
| | ↳ *Resolve incident* | |
| 2 | **Incident Manager** - Resolving incident & re-run pipeline | Resolve incident and rerun pipeline  Resolves a failed incident from the list page, confirms closed status, and reruns the TestSuite pipeline to re-evaluate incident state. |
| | ↳ *Acknowledge table test case's failure* | |
| | ↳ *Resolve task from incident list page* | |
| | ↳ *Task should be closed* | |
| | ↳ *Re-run pipeline* | |
| | ↳ *Verify open and closed task* | |
| 3 | **Incident Manager** - Rerunning pipeline for an open incident | Rerun pipeline for open incident  Acknowledges and assigns an open incident, reruns pipeline, and validates status reflects Assigned. |
| | ↳ *Ack incident and verify open task* | |
| | ↳ *Assign incident to user* | |
| | ↳ *Re-run pipeline* | |
| | ↳ *Verify incident's status on DQ page* | |
| 4 | **Incident Manager** - Validate Incident Tab in Entity details page | Validate Incident tab in entity page  Verifies incidents list within entity details, lineage incident counts, and navigation back to tab. |
| 5 | **Incident Manager** - Verify filters in Incident Manager's page | Verify filters in Incident Manager page  Tests Assignee, Status, Test Case, and Date filters and confirms list updates accordingly. |

</details>


---

<div id="alerts-notifications"></div>

## Alerts & Notifications

<details open>
<summary>📄 <b>NotificationAlerts.spec.ts</b> (6 tests, 17 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Single Filter Alert | Single Filter Alert  Creates an alert with a single filter and verifies alert details; edits by adding filters and destinations, then deletes the alert. |
| | ↳ *Create alert* | |
| | ↳ *Check created alert details* | |
| | ↳ *Edit alert by adding multiple filters and internal destinations* | |
| | ↳ *Delete alert* | |
| 2 | Multiple Filters Alert | Multiple Filters Alert  Creates an alert with multiple filters and destinations; edits by removing filters/destinations, verifies changes, then deletes the alert. |
| | ↳ *Create alert* | |
| | ↳ *Edit alert by removing added filters and internal destinations* | |
| | ↳ *Delete alert* | |
| 3 | Task source alert | Task Source Alert  Creates an alert scoped to Task source and then deletes it. |
| | ↳ *Create alert* | |
| | ↳ *Delete alert* | |
| 4 | Conversation source alert | Conversation Source Alert  Creates a Conversation source alert, adds a mentions filter and Slack destination, then deletes it. |
| | ↳ *Create alert* | |
| | ↳ *Edit alert by adding mentions filter* | |
| | ↳ *Delete alert* | |
| 5 | Alert operations for a user with and without permissions | Alert operations with permissions  Creates and triggers a Table source alert; verifies alert details for permissive user and limited behavior for a non-permissive user; deletes the alert. |
| | ↳ *Create and trigger alert* | |
| | ↳ *Checks for user without permission* | |
| | ↳ *Check alert details page and Recent Events tab* | |
| | ↳ *Delete alert* | |
| 6 | destination should work properly | Destination test flow  Validates internal/external destination configuration, tests destinations, and verifies UI result statuses. |

</details>

<details open>
<summary>📄 <b>ObservabilityAlerts.spec.ts</b> (6 tests, 21 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/ObservabilityAlerts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ObservabilityAlerts.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Pipeline Alert | Pipeline Alert |
| | ↳ *Create alert* | |
| | ↳ *Verify diagnostic info tab* | |
| | ↳ *Check created alert details* | |
| | ↳ *Edit alert* | |
| | ↳ *Delete alert* | |
| 2 | Table alert | Table alert |
| | ↳ *Create alert* | |
| | ↳ *Check created alert details* | |
| | ↳ *Delete alert* | |
| 3 | Ingestion Pipeline alert | Ingestion Pipeline alert |
| | ↳ *Create alert* | |
| | ↳ *Check created alert details* | |
| | ↳ *Delete alert* | |
| 4 | Test case alert | Case alert |
| | ↳ *Create alert* | |
| | ↳ *Check created alert details* | |
| | ↳ *Delete alert* | |
| 5 | Test Suite alert | Suite alert |
| | ↳ *Create alert* | |
| | ↳ *Check created alert details* | |
| | ↳ *Delete alert* | |
| 6 | Alert operations for a user with and without permissions | Alert operations for a user with and without permissions |
| | ↳ *Create and trigger alert* | |
| | ↳ *Checks for user without permission* | |
| | ↳ *Check alert details page and Recent Events tab* | |
| | ↳ *Delete alert* | |

</details>


---

<div id="profiler"></div>

## Profiler

<details open>
<summary>📄 <b>DataQualityAndProfiler.spec.ts</b> (7 tests, 20 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Table test case | Table test case  Creates, edits, and deletes a table-level test case with tags and glossary terms. Verifies incident breadcrumb navigation and test case property changes. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Redirect to IncidentPage and verify breadcrumb* | |
| | ↳ *Delete* | |
| 2 | Column test case | Column test case  Creates, edits, and deletes a column-level test case with tags and glossary terms. Validates parameter changes and property persistence. |
| | ↳ *Create* | |
| | ↳ *Edit* | |
| | ↳ *Redirect to IncidentPage and verify breadcrumb* | |
| | ↳ *Delete* | |
| 3 | Profiler matrix and test case graph should visible for admin, data consumer and data steward | Profiler matrix and test case visibility for roles  Validates profiler matrix and test case graph visibility for admin, data consumer, and data steward roles. Verifies table profile data, test case results, and filtering. |
| 4 | TestCase with Array params value | TestCase with Array params value |
| | ↳ *Array params value should be visible while editing the test case* | |
| | ↳ *Validate patch request for edit test case* | |
| | ↳ *Update test case display name from Data Quality page* | |
| 5 | Update profiler setting modal | Update profiler setting modal |
| | ↳ *Update profiler setting* | |
| | ↳ *Reset profile sample type* | |
| 6 | TestCase filters | TestCase filters |
| 7 | Pagination functionality in test cases list | Pagination functionality in test cases list |
| | ↳ *Verify pagination controls are visible* | |
| | ↳ *Verify first page state* | |
| | ↳ *Navigate to next page* | |
| | ↳ *Navigate back to previous page* | |
| | ↳ *Test page size dropdown* | |

</details>

<details open>
<summary>📄 <b>ProfilerConfigurationPage.spec.ts</b> (2 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts)

### Profiler Configuration Page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Profiler Configuration Page** - Admin user | Admin user profiler configuration  Validates form validation, profiler config creation, updates, and removal for admin users. Verifies metric selection, data type filtering, and API interactions. |
| | ↳ *Verify validation* | |
| | ↳ *Update profiler configuration* | |
| | ↳ *Remove Configuration* | |
| 2 | **Profiler Configuration Page** - Non admin user | Non-admin user access restriction  Verifies that non-admin users cannot access profiler configuration preferences. |

</details>


---

