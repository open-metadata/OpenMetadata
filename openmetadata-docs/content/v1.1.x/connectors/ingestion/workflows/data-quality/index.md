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
Test Suites are logical container allowing you to group related Test Cases together from different tables. 

### Test Definition
Test Definitions are generic tests definition elements specific to a test such as:
- test name
- column name
- data type

### Test Cases
Test Cases specify a Test Definition. It will define what condition a test must meet to be successful (e.g. `max=n`, etc.). One Test Definition can be linked to multiple Test Cases.

## Adding Test Cases to an Entity
Tests cases are actual test that will be run and executed against your entity. This is where you will define the execution time and logic of these tests
**Note:** you will need to make sure you have the right permission in OpenMetadata to create a test.

## Step 1: Creating a Test Case
Navigate to the entity you want to add a test (we currently support quality test only for database entity). Go to `Profiler & Data Quality` tab. From there, click on the `Add Test` button in the upper right corner and select the type of test you want to implement

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/add-test-case.png"
  alt="Write your first test"
  caption="Write your first test"
 /%}

## Step 2: Select the Test Type
Select the type of test you want to run and set the parameters (if any) for your test case. If you have select a `column` test, you will need to select which column you want to execute your test against. Give it a name and then submit it.

**Note:** if you have a profiler workflow running, you will be able to visualize some context around your column or table data.

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/add-test-defintion.png"
  alt="Write your first test"
  caption="Write your first test"
 /%}

## Step 3: Set an Execution Schedule (Optional)
If it is the first test you are creating for this entity, you'll need to set an execution time. click on `Add Ingestion` button and select a schedule. Note that the time is shown in UTC.

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/add-ingestion.png"
  alt="Write your first test"
  caption="Write your first test"
 /%}

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/ingestion-page.png"
  alt="Write your first test"
  caption="Write your first test"
 /%}

## Adding Test Suites Through the UI
Test Suites are logical container allowing you to group related Test Cases together from different tables. 
**Note:** you will need to make sure you have the right permission in OpenMetadata to create a test.

### Step 1: Creating a Test Suite
From the vertical navigation bar, click on `Quality` and navigate to the `By Test Suites` tab. From there click on `Add Test Suite` button in the top right corner.

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/profiler-tab-view.png"
  alt="Write your first test"
  caption="Write your first test"
 /%}


On the next page, enter the name and description (optional) of your test suite.

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/test-suite-page.png"
  alt="Create test suite"
  caption="Create test suite"
 /%}


### Step 2: Add Test Cases
On the next page, you will be able to add existing test cases from different entity to your test suite. This allows you to group together test cases from different entities

**Note:** Test Case name needs to be unique across the whole platform. A warning message will show if your Test Case name is not unique.

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/test-case-page.png"
  alt="Create test case"
  caption="Create test case"
 /%}


## Adding Tests with the YAML Config
When creating a JSON config for a test workflow the source configuration is very simple.
```yaml
source:
  type: TestSuite
  serviceName: <your_service_name>
  sourceConfig:
    config:
      type: TestSuite
      entityFullyQualifiedName: <entityFqn>
```
The only sections you need to modify here are the `serviceName` (this name needs to be unique) and `entityFullyQualifiedName` (the entity for which we'll be executing tests against) keys.

Once you have defined your source configuration you'll need to define te processor configuration. 
```yaml
processor:
  type: "orm-test-runner"
  config:
    forceUpdate: <false|true>
    testCases:
      - name: <testCaseName>
        testDefinitionName: columnValueLengthsToBeBetween
        columnName: <columnName>
        parameterValues:
          - name: minLength
            value: 10
          - name: maxLength
            value: 25
      - name: <testCaseName>
        testDefinitionName: tableRowCountToEqual
        parameterValues:
          - name: value
            value: 10
```
The processor type should be set to ` "orm-test-runner"`. For accepted test definition names and parameter value names refer to the [tests page](/connectors/ingestion/workflows/data-quality/tests).

### Key reference:
- `forceUpdate`: if the test case exists (base on the test case name) for the entity, implements the strategy to follow when running the test (i.e. whether to update parameters)
- `testCases`: list of test cases to execute against the entity referenced
- `name`: test case name
- `testDefinitionName`: test definition
- `columnName`: only applies to column test. The name of the column to run the test against
- `parameterValues`: parameter values of the test


`sink` and `workflowConfig` will have the same settings as the ingestion and profiler workflow.

### Full  `yaml` config example

```yaml
source:
  type: TestSuite
  serviceName: MyAwesomeTestSuite
  sourceConfig:
    config:
      type: TestSuite
      entityFullyQualifiedName: MySQL.default.openmetadata_db.tag_usage

processor:
  type: "orm-test-runner"
  config:
    forceUpdate: false
    testCases:
      - name: column_value_length_tagFQN
        testDefinitionName: columnValueLengthsToBeBetween
        columnName: tagFQN
        parameterValues:
          - name: minLength
            value: 10
          - name: maxLength
            value: 25
      - name: table_row_count_test
        testDefinitionName: tableRowCountToEqual
        parameterValues:
          - name: value
            value: 10

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
### From the Quality Page
From the home page click on the `Quality` menu item on the vertical navigation. This will bring you to the quality page where you'll be able to see your test cases either by:
- entity
- test suite
- test cases

If you want to look at your tests grouped by Test Suites, navigate to the `By Test Suites` tab. This will bring you to the Test Suite page where you can select a specific Test Suite.

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/test-suite-home-page.png"
  alt="Test suite home page"
  caption="Test suite home page"
 /%}


From there you can select a Test Suite and visualize the results associated with this specific Test Suite.

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/test-suite-results.png"
  alt="Test suite results page"
  caption="Test suite results page"
 /%}


### From a Table Entity
Navigate to your table and click on the `profiler & Data Quality` tab. From there you'll be able to see test results at the table or column level.
#### Table Level Test Results
In the top panel, click on the white background `Data Quality` button. This will bring you to a summary of all your quality tests at the table level

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/table-results-entity.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}

 ## Test Case Resolution Workflow
 In v1.1.0 we introduce the ability for user to flag the resolution status of failed test cases. When a test case fail, it will automatically be marked as new. It indicates that a new failure has happened.

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/resolution-workflow-new.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}

The next step for a user is to mark the new failure as `ack` (acknowledged) signifying to users that someone is looking into test failure resolution. When hovering over the resolution status user will be able to see the time (UTC) and the user who acknowledge the failure

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/resolution-workflow-ack-form.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}
{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/resolution-workflow-ack.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}

 Then user are able to mark a test as `resolved`. We made it mandatory for users to 1) select a reason and 2) add a comment when resolving failed test so that knowledge can be maintained inside the platform.

{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/resolution-workflow-resolved-form.png.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}
{% image
  src="/images/v1.1/features/ingestion/workflows/data-quality/resolution-workflow-resolved.png.png"
  alt="Test suite results table"
  caption="Test suite results table"
 /%}
