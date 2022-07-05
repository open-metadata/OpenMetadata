---
description: Use your own Airflow instance to schedule and run the Hive Connector.
---

# Run Hive Connector using Airflow SDK

Configure and schedule Hive **metadata**, **usage**, and **profiler** workflows using your own Airflow instances.

* [Requirements](run-hive-connector-using-airflow-sdk.md#requirements)
* [Metadata Ingestion](run-hive-connector-using-airflow-sdk.md#metadata-ingestion)
* [Data Profiler and Quality Tests](run-hive-connector-using-airflow-sdk.md#data-profiler-and-quality-tests)
* [DBT Integration](run-hive-connector-using-airflow-sdk.md#dbt-integration)

## Requirements

Follow this [guide](../../airflow/) to learn how to set up Airflow to run the metadata ingestions.

### **Install the Python module for this connector**

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for this connector.

```javascript
pip3 install 'openmetadata-ingestion[hive]'
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/hiveConnection.json) you can find the structure to create a connection to Hive.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a JSON configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Create a configuration file using template YAML

Create a new file called `hive.yaml` in the current directory. Note that the current directory should be the `openmetadata` directory.

Copy and paste the configuration template below into the `hive.yaml` the file you created.

{% code title="hive.yaml" %}
```json
source:
  type: hive
  serviceName: local_hive
  serviceConnection:
    config:
      type: Hive
      username: "<username>"
      password: "<password>"
      database: "<database>"
      authOptions: "<auth optios>"
      hostPort: "<hive connection host & port>"
  sourceConfig:
    config:
      enableDataProfiler: true or false
      markDeletedTables: true or false
      includeTables: true or false
      includeViews: true or false
      generateSampleData: true or false
      sampleDataQuery: "<query to fetch table data>"
      schemaFilterPattern: "<schema name regex list>"
      tableFilterPattern: "<table name regex list>"
      dbtConfigSource: "<configs for gcs, s3, local or file server to get the DBT
        files"
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "<OpenMetadata host and port>"
    authProvider: "<OpenMetadata auth provider>"

```
{% endcode %}

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/hiveConnection.json).

* **username** (Optional): Enter the username of your Hive user in the _Username_ field. The specified user should be authorized to read all databases you want to include in the metadata ingestion workflow.
* **password** (Optional): Enter the password for your Hive user in the _Password_ field.
* **hostPort**: Enter the fully qualified hostname and port number for your Hive deployment in the _Host and Port_ field.
* **authOptions** (Optional): Enter the auth options string for hive connection.
* **database**: If you want to limit metadata ingestion to a single database, enter the name of this database in the Database field. If no value is entered for this field, the connector will ingest metadata from all databases that the specified user is authorized to read.
* **connectionOptions** (Optional): Enter the details for any additional connection options that can be sent to Hive during the connection. These details must be added as Key-Value pairs.
* **connectionArguments** (Optional): Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Hive during the connection. These details must be added as Key-Value pairs.

To specify LDAP Auth, use the following `connectionArguments`:

```
"connectionArguments": {
"auth": "LDAP"
}
```

In this step, we will configure the Hive service settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Hive service as desired.

#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json).

* **enableDataProfiler**: \*\*\*\* `true` or `false`, to run the profiler (not the tests) during the metadata ingestion.
* **markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.
* **includeTables**: `true` or `false`, to ingest table data. Default is true.
* **includeViews**: `true` or `false`, to ingest views definitions.
* **generateSampleData**: To ingest sample data based on `sampleDataQuery`.
* **sampleDataQuery**: Defaults to `select * from {}.{} limit 50`.
* **schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

```
tableFilterPattern:
  includes:
    - users
    - type_test
```

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `"type": "metadata-rest"`.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

#### OpenMetadata Security Providers

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/security/client). An example of an Auth0 configuration would be the following:

```
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: auth0
    securityConfig:
      clientId: <client ID>
      secretKey: <secret key>
      domain: <domain>
```

#### Edit a Python script to define your ingestion DAG

Copy and paste the code below into a file called `openmetadata-airflow.py`.

```python
import yaml
from datetime import timedelta

from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from airflow.utils.dates import days_ago

from metadata.ingestion.api.workflow import Workflow

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(seconds=10),
    "execution_timeout": timedelta(minutes=60),
}

config = """
  ## REPLACE THIS LINE WITH YOUR CONFIGURATION JSON
"""

def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()

with DAG(
    "openmetadata_athena_connector",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )
```

#### 11. Copy your configuration JSON into the ingestion script

In steps 3 - 9 above you created a JSON file with the configuration for your ingestion connector. Copy that JSON into the `openmetadata-airflow.py` file that you created in step 10 as directed by the comment below.

```
config = """
  ## REPLACE THIS LINE WITH YOUR CONFIGURATION JSON
"""
```

#### 12. Run the script to create your ingestion DAG

Run the following command to create your ingestion DAG in Airflow.

```
python openmetadata-airflow.py
```

## Data Profiler and Quality Tests

The Data Profiler workflow will be using the `orm-profiler` processor. While the `serviceConnection` will still be the same to reach the source system, the `sourceConfig` will be updated from previous configurations.

### 1. Define the YAML configuration

This is a sample config for a Hive profiler:

```json
source:
  type: hive
  serviceName: "<service name>"
  serviceConnection:
    config:
      type: Hive
      hostPort: "<hostPort>"
      username: "<username>"
      password: "<password>"
      database: "<database>"
      warehouse: "<warehouse>"
      account: "<acount>"
      privateKey: "<privateKey>"
      snowflakePrivatekeyPassphrase: "<passphrase>"
      scheme: "<scheme>"
      role: "<role>"
  sourceConfig:
    config:
      type: Profiler
      fqnFilterPattern: "<table FQN filtering regex>"
processor:
  type: orm-profiler
  config: {}
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "<OpenMetadata host and port>"
    authProvider: "<OpenMetadata auth provider>"

```

#### Source Configuration

* You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/hiveConnection.json).
* The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json). If you don't need to add any `fqnFilterPattern`, the `"type": "Profiler"` is still required to be present.

Note that the `fqnFilterPattern` supports regex as `include` or `exclude`. E.g.,

```
"fqnFilterPattern": {
  "includes": ["service.database.schema.*"]
}
```

#### Processor

To choose the `orm-profiler`. It can also be updated to define tests from the YAML itself instead of the UI:

```json
processor:
  type: orm-profiler
  config:
    test_suite:
      name: "<Test Suite name>"
      tests:
      - table: "<Table FQN>"
        table_tests:
        - testCase:
            config:
              value: 100
            tableTestType: tableRowCountToEqual
        column_tests:
        - columnName: "<Column Name>"
          testCase:
            config:
              minValue: 0
              maxValue: 99
            columnTestType: columnValuesToBeBetween

```

`tests` is a list of test definitions that will be applied to `table`, informed by its FQN. For each table, one can then define a list of `table_tests` and `column_tests`. Review the supported tests and their definitions to learn how to configure the different cases [here](broken-reference).

#### Workflow Configuration

The same as the [metadata](run-hive-connector-using-airflow-sdk.md#workflow-configuration) ingestion.

### 2. Prepare the Ingestion DAG

Here, we follow a similar approach as with the metadata and usage pipelines, although we will use a different Workflow class:

```python
import yaml
from datetime import timedelta

from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from airflow.utils.dates import days_ago

from metadata.orm_profiler.api.workflow import ProfilerWorkflow


default_args = {
    "owner": "user_name",
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(seconds=10),
    "execution_timeout": timedelta(minutes=60),
}

config = """
<your YAML configuration>
"""

def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = ProfilerWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()

with DAG(
    "profiler_example",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="profile_and_test_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )
```

## DBT Integration

You can learn more about how to ingest DBT models' definitions and their lineage [here](broken-reference).
