---
title: How to Write and Deploy No-Code Test Cases
description: Test ingestion rules using YAML-defined logic to enforce expectations across datasets and sources.
slug: /how-to-guides/data-quality-observability/quality/test
---

# How to Write and Deploy No-Code Test Cases

OpenMetadata supports data quality tests at the table and column level on all of the supported database connectors. OpenMetadata supports both business-oriented tests as well as data engineering tests. The data engineering tests are more on the technical side to ascertain a sanity check on the data. It ensures that your data meets the technical definition of the data assets, like the columns are not null, columns are unique, etc.

There is no need to fill a YAML file or a JSON config file to set up data quality tests in OpenMetadata. You can simply select the options and add in the details right from the UI to set up test cases.

To create a test in OpenMetadata:

- Navigate to the table you would like to create a test for. Click on the **Data Observability** tab.
- Click on **Add Test** to select a `Table` or `Column` level test.

{% image
src="/images/v1.9/how-to-guides/quality/test1.png"
alt="Write and Deploy No-Code Test Cases"
caption="Write and Deploy No-Code Test Cases"
/%}

## Table Level Test

To create a **Table Level Test** enter the following details:
- **Name:** Add a name that best defines your test case.
- **Test Type:** Based on the test type, you will have further fields to define your test.
- **Description:** Describe the test case.
Click on **Submit** to set up a test.

OpenMetadata currently supports the following table level test types:
1. Table Column Count to be Between: Define the Min. and Max.
2. Table Column Count to Equal: Define a number.
3. Table Column Name to Exist: Define a column name.
4. Table Column Names to Match Set: Add comma separated column names to match. You can also verify if the column names are in order.
5. Custom SQL Query: Define a SQL expression. Select a strategy if it should apply for Rows or for Count. Define a threshold to determine if the test passes or fails.
6. Table Row Count to be Between: Define the Min. and Max.
7. Table Row Count to Equal: Define a number.
8. Table Row Inserted Count to be Between: Define the Min. and Max. row count. This test will work for columns whose values are of the type Timestamp, Date, and Date Time field. Specify the range type in terms of Hour, Day, Month, or Year. Define the interval based on the range type selected.
9. Compare 2 Tables for Differences: Compare 2 tables for differences. Allows a user to check for integrity.
10. Table Data to Be Fresh: Validate the freshness of a table's data (Collate).

{% image
src="/images/v1.9/how-to-guides/quality/test4.png"
alt="Configure a Table Level Test"
caption="Configure a Table Level Test"
/%}

## Column Level Test

To create a **Column Level Test** enter the following details:
- **Column:** Select a column. On the right hand side, you can view some context about that column.
- **Name:** Add a name that best defines your test case.
- **Test Type:** Based on the test type, you will have further fields to define your test.
- **Description:** Describe the test case.
Click on **Submit** to set up a test.

OpenMetadata currently supports the following column level test types:
1. Column Value Lengths to be Between: Define the Min. and Max.
2. Column Value Max. to be Between: Define the Min. and Max.
3. Column Value Mean to be Between: Define the Min. and Max.
4. Column Value Median to be Between: Define the Min. and Max.
5. Column Value Min. to be Between: Define the Min. and Max.
6. Column Values Missing Count: Define the number of missing values. You can also match all null and empty values as missing. You can also configure additional missing strings like N/A.
7. Column Values Sum to be Between: Define the Min. and Max.
8. Column Value Std Dev to be Between: Define the Min. and Max.
9. Column Values to be Between: Define the Min. and Max.
10. Column Values to be in Set: You can add an array of allowed values.
11. Column Values to be Not in Set: You can add an array of forbidden values.
12. Column Values to be Not Null
13. Column Values to be Unique
14. Column Values to Match Regex Pattern: Define the regular expression that the column entries should match.
15. Column Values to Not Match Regex: Define the regular expression that the column entries should not match.

{% image
src="/images/v1.9/how-to-guides/quality/test2.png"
alt="Configure a Column Level Test"
caption="Configure a Column Level Test"
/%}

Once the test has been created, you can view the test suite. The test case will be displayed in the Data Quality tab. You can also edit the Display Name and Description for the test.

{% image
src="/images/v1.9/how-to-guides/quality/test3.png"
alt="Column Level Test Created"
caption="Column Level Test Created"
/%}

A pipeline can be set up for the tests to run at a regular cadence.
- Click on the `Pipeline` tab
- Add a pipeline

{% image
src="/images/v1.9/how-to-guides/quality/test5.png"
alt="Set up a Pipeline"
caption="Set up a Pipeline"
/%}

- Set up the scheduler for the desired frequency. The timezone is in UTC.
- Click on **Submit**.

{% image
src="/images/v1.9/how-to-guides/quality/test6.png"
alt="Schedule the Pipeline"
caption="Schedule the Pipeline"
/%}

The pipeline has been set up and will run at the scheduled time.

{% image
src="/images/v1.9/how-to-guides/quality/test7.png"
alt="Pipeline Scheduled"
caption="Pipeline Scheduled"
/%}

The tests will be run and the results will be updated in the Data Quality tab.

{% image
src="/images/v1.9/how-to-guides/quality/test8.png"
alt="Data Quality Tests"
caption="Data Quality Tests"
/%}

If a **test fails**, you can **Edit the Test Status** to New, Acknowledged, or Resolved status by clicking on the Status icon.

{% image
src="/images/v1.9/how-to-guides/quality/test9.png"
alt="Failed Test: Edit Status"
caption="Failed Test: Edit Status"
/%}

- Select the Test Status
{% image
src="/images/v1.9/how-to-guides/quality/test10.png"
alt="Edit Test Status"
caption="Edit Test Status"
/%}

- If you are marking the test status as **Resolved**, you must specify the **Reason** for the failure and add a **Comment**. The reasons for failure can be Duplicates, False Positive, Missing Data, Other, or Out of Bounds.
- Click on **Submit**.
{% image
src="/images/v1.9/how-to-guides/quality/test11.png"
alt="Resolved Status: Reason"
caption="Resolved Status: Reason"
/%}

Users can also set up [alerts](/how-to-guides/data-quality-observability/observability/alerts) to be notified when a test fails.

 {%inlineCallout
  color="violet-70"
  bold="How to Set Alerts for Test Case Fails"
  icon="MdArrowForward"
  href="/how-to-guides/data-quality-observability/observability/alerts"%}
  Get notified when a data quality test fails.
 {%/inlineCallout%}
 