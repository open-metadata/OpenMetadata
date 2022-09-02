---
title: Data Quality
slug: /openmetadata/ingestion/workflows/data-quality
---

# Data Quality
Learn how you can use OpenMetadata to define Data Quality tests and measure your data reliability.
## Requirements

### OpenMetadata (version 0.12 or later)

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
Test Suites are containers allowing you to group related Test Cases together. Once configured, a Test Suite can easily be deployed to execute all the Test Cases it contains. 

### Test Definition
Test Definitions are generic tests definition elements specific to a test such as:
- test name
- column name
- data type

### Test Cases
Test Cases specify a Test Definition. It will define what condition a test must meet to be successful (e.g. `max=n`, etc.). One Test Definition can be linked to multiple Test Cases.

## Adding Tests Through the UI
**Note:** you will need to make sure you have the right permission in OpenMetadata to create a test.

### Step 1: Creating a Test Suite
From your table service click on the `profiler` tab. From there you will be able to create table tests by clicking on the purple background `Add Test` top button or column tests by clicking on the white background `Add Test` button.
<Image
    src={"openmetadata-docs/images/openmetadata/ingestion/workflows/data-quality/profiler-tab-view.png"}
    alt="Write your first test"
    caption="Write your first test"
/>  

On the next page you will be able to either select an existing Test Suite or Create a new one. If you select an existing one your Test Case will automatically be added to the Test Suite

<Image
    src={"openmetadata-docs/images/openmetadata/ingestion/workflows/data-quality/test-suite-page.png"}
    alt="Create test suite"
    caption="Create test suite"
/>  

### Step 2: Create a Test Case
On the next page, you will create a Test Case. You will need to select a Test Definition from the drop down menu and specify the parameters of your Test Case.

**Note:** Test Case name needs to be unique across the whole platform. A warning message will show if your Test Case name is not unique.

<Image
    src={"openmetadata-docs/images/openmetadata/ingestion/workflows/data-quality/test-case-page.png"}
    alt="Create test case"
    caption="Create test case"
/> 

### Step 3: Add Ingestion Workflow
If you have created a new test suite you will see a purple background `Add Ingestion` button after clicking `submit`. This will allow you to schedule the execution of your Test Suite. If you have selected an existing Test Suite you are all set.

After clicking `Add Ingestion` you will be able to select an execution schedule for your Test Suite (note that you can edit this later). Once you have selected the desired scheduling time, click submit and you are all set.

<Image
    src={"openmetadata-docs/images/openmetadata/ingestion/workflows/data-quality/ingestion-page.png"}
    alt="Create ingestion workflow"
    caption="Create ingestion workflow"
/> 


## Adding Tests with the YAML Config
When creating a JSON config for a test workflow the source configuration is very simple.
```
source:
  type: TestSuite
  serviceName: <your_service_name>
  sourceConfig:
    config:
      type: TestSuite
```
The only section you need to modify here is the `serviceName` key. Note that this name needs to be unique across OM platform Test Suite name.

Once you have defined your source configuration you'll need to define te processor configuration. 
```
processor:
  type: "orm-test-runner"
  config:
    testSuites:
      - name: [test_suite_name]
        description: [test suite description]
        testCases:
          - name: [test_case_name]
            description: [test case description]
            testDefinitionName: [test definition name*]
            entityLink: ["<#E::table::fqn> or <#E::table::fqn::columns::column_name>"]
            parameterValues:
              - name: [column parameter name]
                value: [value]
              - ...
```
The processor type should be set to ` "orm-test-runner"`. For accepted test definition names and parameter value names refer to the [tests page](/openmetadata-docs/content/openmetadata/ingestion/workflows/data-quality/tests.md).


`sink` and `workflowConfig` will have the same settings than the ingestion and profiler workflow.

### Full `yaml` config example

```
source:
  type: TestSuite
  serviceName: MyAwesomeTestSuite
  sourceConfig:
    config:
      type: TestSuite
    
processor:
  type: "orm-test-runner"
  config:
    testSuites:
      - name: test_suite_one
        description: this is a test testSuite to confirm test suite workflow works as expected
        testCases:
          - name: a_column_test
            description: A test case
            testDefinitionName: columnValuesToBeBetween
            entityLink: "<#E::table::local_redshift.dev.dbt_jaffle.customers::columns::number_of_orders>"     
            parameterValues:
              - name: minValue
                value: 2
              - name: maxValue
                value: 20

sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

### How to Run Tests
To run the tests from the CLI execute the following command
```
metadata test -c /path/to/my/config.yaml
```

## How to Visualize Test Results
### From the Test Suite View
From the home page click on the Test Suite menu in the left pannel.
<Image
    src={"openmetadata-docs/images/openmetadata/ingestion/workflows/data-quality/test-suite-home-page.png"}
    alt="Test suite home page"
    caption="Test suite home page"
/> 

This will bring you to the Test Suite page where you can select a specific Test Suite.
<Image
    src={"openmetadata-docs/images/openmetadata/ingestion/workflows/data-quality/test-suite-landing.png"}
    alt="Test suite landing page"
    caption="Test suite landing page"
/>

From there you can select a Test Suite and visualize the results associated with this specific Test Suite.
<Image
    src={"openmetadata-docs/images/openmetadata/ingestion/workflows/data-quality/test-suite-results.png"}
    alt="Test suite results page"
    caption="Test suite results page"
/>

### From a Table Entity
Navigate to your table and click on the `profiler` tab. From there you'll be able to see test results at the table or column level.
#### Table Level Test Results
In the top pannel, click on the white background `Data Quality` button. This will bring you to a summary of all your quality tests at the table level
<Image
    src={"openmetadata-docs/images/openmetadata/ingestion/workflows/data-quality/table-results-entity.png"}
    alt="Test suite results table"
    caption="Test suite results table"
/>

#### Column Level Test Results
On the profiler page, click on a specific column name. This will bring you to a new page where you can click the white background `Quality Test` button to see all the tests results related to your column.
<Image
    src={"openmetadata-docs/images/openmetadata/ingestion/workflows/data-quality/colum-level-test-results.png"}
    alt="Test suite results table"
    caption="Test suite results table"
/>

## Adding Custom Tests
While OpenMetadata provides out of the box tests, you may want to write your test results from your own custom quality test suite. This is very easy to do using the API.
### Creating a `TestDefinition`



### Creating a `TestCase`

### Writing `TestCaseResults`

## Test From 3rd Party Tools



## Where are the Tests stored?