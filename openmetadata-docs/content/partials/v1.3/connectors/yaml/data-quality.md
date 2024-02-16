## Data Quality

### Adding Data Quality Test Cases from yaml config

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
- `forceUpdate`: if the test case exists (base on the test case name) for the entity, implements the strategy to follow when running the test (i.e. whether or not to update parameters)
- `testCases`: list of test cases to execute against the entity referenced
- `name`: test case name
- `testDefinitionName`: test definition
- `columnName`: only applies to column test. The name of the column to run the test against
- `parameterValues`: parameter values of the test


`sink` and `workflowConfig` will have the same settings than the ingestion and profiler workflow.

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
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.workflow_output_handler import print_status
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
    print_status(workflow)
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

- You can learn more about how to configure and run the Lineage Workflow to extract Lineage data from [here](/connectors/ingestion/workflows/data-quality)