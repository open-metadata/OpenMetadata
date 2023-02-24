---
title: Data Quality
slug: /connectors/ingestion/workflows/data-quality
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
    src={"/images/openmetadata/ingestion/workflows/data-quality/profiler-tab-view.webp"}
    alt="Write your first test"
    caption="Write your first test"
/>  

On the next page you will be able to either select an existing Test Suite or Create a new one. If you select an existing one your Test Case will automatically be added to the Test Suite

<Image
    src={"/images/openmetadata/ingestion/workflows/data-quality/test-suite-page.webp"}
    alt="Create test suite"
    caption="Create test suite"
/>  

### Step 2: Create a Test Case
On the next page, you will create a Test Case. You will need to select a Test Definition from the drop down menu and specify the parameters of your Test Case.

**Note:** Test Case name needs to be unique across the whole platform. A warning message will show if your Test Case name is not unique.

<Image
    src={"/images/openmetadata/ingestion/workflows/data-quality/test-case-page.webp"}
    alt="Create test case"
    caption="Create test case"
/> 

### Step 3: Add Ingestion Workflow
If you have created a new test suite you will see a purple background `Add Ingestion` button after clicking `submit`. This will allow you to schedule the execution of your Test Suite. If you have selected an existing Test Suite you are all set.

After clicking `Add Ingestion` you will be able to select an execution schedule for your Test Suite (note that you can edit this later). Once you have selected the desired scheduling time, click submit and you are all set.

<Image
    src={"/images/openmetadata/ingestion/workflows/data-quality/ingestion-page.webp"}
    alt="Create ingestion workflow"
    caption="Create ingestion workflow"
/> 


## Adding Tests with the YAML Config
When creating a JSON config for a test workflow the source configuration is very simple.
```yaml
source:
  type: TestSuite
  serviceName: <your_service_name>
  sourceConfig:
    config:
      type: TestSuite
```
The only section you need to modify here is the `serviceName` key. Note that this name needs to be unique across OM platform Test Suite name.

Once you have defined your source configuration you'll need to define te processor configuration. 
```yaml
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
The processor type should be set to ` "orm-test-runner"`. For accepted test definition names and parameter value names refer to the [tests page](/connectors/ingestion/workflows/data-quality/tests).


`sink` and `workflowConfig` will have the same settings than the ingestion and profiler workflow.

### Full  `yaml` config example

```yaml
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
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

### How to Run Tests

To run the tests from the CLI execute the following command
```
metadata test -c /path/to/my/config.yaml
```

### Schedule Test Suite runs with Airflow

As with the Ingestion or Profiler workflow, you can as well execute a Test Suite directly from Python. We are
going to use Airflow as an example, but any orchestrator would achieve the same goal.

Let's prepare the DAG as usual, but importing a different Workflow class:

```python
import pathlib
import yaml
from datetime import timedelta
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.config.common import load_config_file
from metadata.test_suite.api.workflow import TestSuiteWorkflow
from airflow.utils.dates import days_ago

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60)
}

config = """
<your YAML configuration>
"""

def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = TestSuiteWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()

with DAG(
    "test_suite_workflow",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    schedule_interval='*/5 * * * *',
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="test_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )
```

Note how we are using the `TestSuiteWorkflow` class to load and execute the tests based on the YAML
configurations specified above.

## How to Visualize Test Results
### From the Test Suite View
From the home page click on the Test Suite menu in the left pannel.
<Image
    src={"/images/openmetadata/ingestion/workflows/data-quality/test-suite-home-page.webp"}
    alt="Test suite home page"
    caption="Test suite home page"
/> 

This will bring you to the Test Suite page where you can select a specific Test Suite.
<Image
    src={"/images/openmetadata/ingestion/workflows/data-quality/test-suite-landing.webp"}
    alt="Test suite landing page"
    caption="Test suite landing page"
/>

From there you can select a Test Suite and visualize the results associated with this specific Test Suite.
<Image
    src={"/images/openmetadata/ingestion/workflows/data-quality/test-suite-results.webp"}
    alt="Test suite results page"
    caption="Test suite results page"
/>

### From a Table Entity
Navigate to your table and click on the `profiler` tab. From there you'll be able to see test results at the table or column level.
#### Table Level Test Results
In the top pannel, click on the white background `Data Quality` button. This will bring you to a summary of all your quality tests at the table level
<Image
    src={"/images/openmetadata/ingestion/workflows/data-quality/table-results-entity.webp"}
    alt="Test suite results table"
    caption="Test suite results table"
/>

#### Column Level Test Results
On the profiler page, click on a specific column name. This will bring you to a new page where you can click the white background `Quality Test` button to see all the tests results related to your column.
<Image
    src={"/images/openmetadata/ingestion/workflows/data-quality/colum-level-test-results.webp"}
    alt="Test suite results table"
    caption="Test suite results table"
/>

## Adding Custom Tests
While OpenMetadata provides out of the box tests, you may want to write your test results from your own custom quality test suite. This is very easy to do using the API.
### Creating a `TestDefinition`
First, you'll need to create a Test Definition for your test. You can use the following endpoint `/api/v1/testDefinition` using a POST protocol to create your Test Definition. You will need to pass the following data in the body your request at minimum.

```json
{
    "description": "<you test definition description>",
    "entityType": "<TABLE or COLUMN>",
    "name": "<your_test_name>",
    "testPlatforms": ["<any of OpenMetadata,GreatExpectations, dbt, Deequ, Soda, Other>"],
    "parameterDefinition": [
      {
        "name": "<name>"
      },
      {
        "name": "<name>"
      }
    ]
}
```

Here is a complete CURL request

```bash
curl --request POST 'http://localhost:8585/api/v1/testDefinition' \
--header 'Content-Type: application/json' \
--data-raw '{
    "description": "A demo custom test",
    "entityType": "TABLE",
    "name": "demo_test_definition",
    "testPlatforms": ["Soda", "dbt"],
    "parameterDefinition": [{
        "name": "ColumnOne"
    }]
}'
```

Make sure to keep the `UUID` from the response as you will need it to create the Test Case.

### Creating a `TestSuite`
You'll also need to create a Test Suite for your Test Case -- note that you can also use an existing one if you want to. You can use the following endpoint `/api/v1/testSuite` using a POST protocol to create your Test Definition. You will need to pass the following data in the body your request at minimum.

```json
{
  "name": "<test_suite_name>",
  "description": "<test suite description>"
}
```

Here is a complete CURL request

```bash
curl --request POST 'http://localhost:8585/api/v1/testSuite' \
--header 'Content-Type: application/json' \
--data-raw '{
  "name": "<test_suite_name>",
  "description": "<test suite description>"
}'
```

Make sure to keep the `UUID` from the response as you will need it to create the Test Case.


### Creating a `TestCase`
Once you have your Test Definition created you can create a Test Case -- which is a specification of your Test Definition. You can use the following endpoint `/api/v1/testCase` using a POST protocol to create your Test Case. You will need to pass the following data in the body your request at minimum.

```json
{
    "entityLink": "<#E::table::fqn> or <#E::table::fqn::columns::column name>",
    "name": "<test_case_name>",
    "testDefinition": {
        "id": "<test definition UUID>",
        "type": "testDefinition"
    },
    "testSuite": {
        "id": "<test suite UUID>",
        "type": "testSuite"
    }
}
```
**Important:** for `entityLink` make sure to include the starting and ending `<>`

Here is a complete CURL request

```bash
curl --request POST 'http://localhost:8585/api/v1/testCase' \
--header 'Content-Type: application/json' \
--data-raw '{
    "entityLink": "<#E::table::local_redshift.dev.dbt_jaffle.customers>",
    "name": "custom_test_Case",
    "testDefinition": {
        "id": "1f3ce6f5-67be-45db-8314-2ee42d73239f",
        "type": "testDefinition"
    },
    "testSuite": {
        "id": "3192ed9b-5907-475d-a623-1b3a1ef4a2f6",
        "type": "testSuite"
    },
    "parameterValues": [
        {
            "name": "colName",
            "value": 10
        }
    ]
}'
```

Make sure to keep the `UUID` from the response as you will need it to create the Test Case.


### Writing `TestCaseResults`
Once you have your Test Case created you can write your results to it. You can use the following endpoint `/api/v1/testCase/{test FQN}/testCaseResult` using a PUT protocol to add Test Case Results. You will need to pass the following data in the body your request at minimum.

```json
{
    "result": "<result message>",
    "testCaseStatus": "<Success or Failed or Aborted>",
    "timestamp": <Unix timestamp>,
    "testResultValue": [
      {
        "value": "<value>"
      }
    ]
}
```

Here is a complete CURL request

```bash
curl --location --request PUT 'http://localhost:8585/api/v1/testCase/local_redshift.dev.dbt_jaffle.customers.custom_test_Case/testCaseResult' \
--header 'Content-Type: application/json' \
--data-raw '{
    "result": "found 1 values expected n",
    "testCaseStatus": "Success",
    "timestamp": 1662129151,
    "testResultValue": [{
        "value": "10"
    }]
}'
```

You will now be able to see your test in the Test Suite or the table entity.

