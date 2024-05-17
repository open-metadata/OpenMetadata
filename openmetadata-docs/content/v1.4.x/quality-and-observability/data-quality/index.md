---
title: Data Quality
slug: /quality-and-observability/data-quality
---

# Data Quality

Learn how you can use OpenMetadata to define Data Quality tests and measure your data reliability.

## Requirements

### OpenMetadata

You must have a running deployment of OpenMetadata to use this guide. OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Airflow for metadata ingestion workflows

To deploy OpenMetadata checkout the [deployment guide](/deployment)

### Python (version 3.8.0 or later)

Please use the following command to check the version of Python you have.

```
python3 --version
```

## Building Trust with Data Quality

OpenMetadata is where all users share and collaborate around data. It is where you make your assets discoverable; with data quality you make these assets **trustable**.

This section will show you how to configure and run Data Quality pipelines with the OpenMetadata built-in tests.

## Main Concepts
### Test Suite
Test Suites are logical container allowing you to group related Test Cases together from different tables. This is a great approach to group test case alerts and reduce alerting overload.

### Test Definition
Test Definitions are generic tests definition elements specific to a test such as:
- test name
- column name
- data type

### Test Cases
Test Cases specify a Test Definition. It will define what condition a test must meet to be successful (e.g. `max=n`, etc.). One Test Definition can be linked to multiple Test Cases.

## Adding Test Cases to an Entity
Tests cases are actual test that will be ran and executed against your entity. This is where you will define the execution time and logic of these tests
**Note:** you will need to make sure you have the right permission in OpenMetadata to create a test.

## Step 1: Creating a Test Case
Navigate to the entity you want to add a test to (we currently support quality test only for database entity). Go to `Profiler & Data Quality` tab. From there, click on the `Add Test` button in the upper right corner and select the type of test you want to implement

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/add-test-case.png"
  alt="Write your first test"
  caption="Write your first test"
 /%}

## Step 2: Select the Test Definition
Select the type of test you want to run and set the parameters (if any) for your test case. If you have selected a `column` test, you will need to select which column you want to execute your test against. Give it a name and then submit it.

**Note:** if you have a profiler workflow running, you will be able to visualize some context around your column or table data.

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/add-test-defintion.png"
  alt="Write your first test"
  caption="Write your first test"
 /%}

## Step 3: Set an Execution Schedule (Optional)
If it is the first test you are creating for this entity, you'll need to set an execution time. click on `Add Ingestion` button and select a schedule. Note that the time is shown in UTC.

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/add-ingestion.png"
  alt="Write your first test"
  caption="Write your first test"
 /%}

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/ingestion-page.png"
  alt="Write your first test"
  caption="Write your first test"
 /%}

## Adding Test Suites Through the UI
Test Suites are logical container allowing you to group related Test Cases together from different tables. This is a great way to group related test cases together and set a single alert for test case failure.   
**Note:** you will need to make sure you have the right permission in OpenMetadata to create a test.

### Step 1: Creating a Test Suite
From the vertical navigation bar, click on `Quality` and navigate to the `By Test Suites` tab. From there click on `Add Test Suite` button on the top right corner.

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/profiler-tab-view.png"
  alt="Write your first test"
  caption="Write your first test"
 /%}


On the next page, enter the name and description (optional) of your test suite.

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/test-suite-page.png"
  alt="Create test suite"
  caption="Create test suite"
 /%}


### Step 2: Add Test Cases
On the next page, you will be able to add existing test cases from different entity to your test suite. This allows you to group together test cases from different entities

**Note:** Test Case name needs to be unique across the whole platform. A warning message will show if your Test Case name is not unique.

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/test-case-page.png"
  alt="Create test case"
  caption="Create test case"
 /%}


{% partial file="/v1.4/connectors/yaml/data-quality.md" /%}

## How to Visualize Test Results
### From the Quality Page
From the home page click on the `Quality` menu item on the vertical navigation. This will bring you to the quality page where you'll be able to see your test cases either by:
- entity
- test suite
- test cases

If you want to look at your tests grouped by Test Suites, navigate to the `By Test Suites` tab. This will bring you to the Test Suite page where you can select a specific Test Suite.

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/test-suite-home-page.png"
  alt="Test suite home page"
  caption="Test suite home page"
 /%}


From there you can select a Test Suite and visualize the results associated with this specific Test Suite.

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/test-suite-results.png"
  alt="Test suite results page"
  caption="Test suite results page"
 /%}


### From a Table Entity
Navigate to your table and click on the `profiler & Data Quality` tab. From there you'll be able to see test results at the table or column level.
#### Table Level Test Results
In the top panel, click on the white background `Data Quality` button. This will bring you to a summary of all your quality tests at the table level

{% image
  src="/images/v1.4/features/ingestion/workflows/data-quality/table-results-entity.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}
