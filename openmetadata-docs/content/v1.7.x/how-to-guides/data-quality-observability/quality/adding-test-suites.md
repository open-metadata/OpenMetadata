---
title: Adding test suites through the UI
slug: /how-to-guides/data-quality-observability/quality/adding-test-suites
---

# Adding Test Suites Through the UI
Test Suites are logical container allowing you to group related Test Cases together from different tables. This is a great way to group related test cases together and set a single alert for test case failure.   
**Note:** you will need to make sure you have the right permission in OpenMetadata to create a test.

## Step 1: Creating a Test Suite
From the vertical navigation bar, click on `Quality icon > Data Quality` and navigate to the `By Test Suites` tab. From there click on `Add Test Suite` button on the top right corner.

{% image
  src="/images/v1.7/features/ingestion/workflows/data-quality/profiler-tab-view.png"
  alt="Write your first test"
  caption="Write your first test"
 /%}


On the next page, enter the name and description (optional) of your test suite.

{% image
  src="/images/v1.7/features/ingestion/workflows/data-quality/test-suite-page.png"
  alt="Create test suite"
  caption="Create test suite"
 /%}


## Step 2: Add Test Cases
On the next page, you will be able to add existing test cases from different entity to your test suite. This allows you to group together test cases from different entities

**Note:** Test Case name needs to be unique across the whole platform. A warning message will show if your Test Case name is not unique.

{% image
  src="/images/v1.7/features/ingestion/workflows/data-quality/test-case-page.png"
  alt="Create test case"
  caption="Create test case"
 /%}


{% partial file="/v1.7/connectors/yaml/data-quality.md" /%}
