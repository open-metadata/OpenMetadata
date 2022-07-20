# Installation and deployment instructions (using Postgres as example)

Below are the instructions for connecting a Postgress server. The installation steps should be the same for connecting all kinds of servers. Different servers would require different configurations in the .yaml or DAG files. See https://docs.open-metadata.org/integrations/connectors for your configuration.

# Goal: To run Postgres metadata ingestion and quality tests with OpenMetadata using Airflow scheduler

Note: This procedure does not support Windows, because Windows does not implement "signal.SIGALRM". **It is highly recommended to use WSL 2 if you are on Windows**.

## Requirements:
See https://docs.open-metadata.org/overview/run-openmetadata-with-prefect "Requirements" section

## Installation:
1. Clone this git hub repo:
`git clone https://github.com/open-metadata/OpenMetadata.git`

2. Cd to ~/.../openmetadata/docker/metadata

3. Start the OpenMetadata containers. This will allow you run OpenMetadata in Docker:
`docker compose up -d`
- To check the status of services, run `docker compose ps` 
- To access the UI: http://localhost:8585

4. Install the OpenMetadata ingestion package.
- (optional but highly recommended): Before installing this package, it is recommended to create and activate a virtual environment. To do this, run:
`python -m venv env` and `source env/bin/activate`

- To install the OpenMetadata ingestion package:
`pip install --upgrade "openmetadata-ingestion[docker]==0.10.3"` (specify the release version to ensure compatibility)

5. Install Airflow:
- 5A: Install Airflow Lineage Backend: `pip3 install "openmetadata-ingestion[airflow-container]"==0.10.3`
- 5B: Install Airflow postgres connector module: `pip3 install "openmetadata-ingestion[postgres]"==0.10.3`
- 5C: Install Airflow APIs: `pip3 install "openmetadata-airflow-managed-apis"==0.10.3`
- 5D: Install necessary Airflow plugins:
    - 1) Download the latest openmetadata-airflow-apis-plugins release from https://github.com/open-metadata/OpenMetadata/releases
    - 2) Untar it under your {AIRFLOW_HOME} directory (usually c/Users/Yourname/airflow). This will create and setup a plugins directory under {AIRFLOW_HOME} .
    - 3) `cp -r {AIRFLOW_HOME}/plugins/dag_templates {AIRFLOW_HOME}`
    - 4) `mkdir -p {AIRFLOW_HOME}/dag_generated_configs`
    - 5) (re)start the airflow webserver and scheduler

6. Configure Airflow:
- 6A: configure airflow.cfg in your AIRFLOW_HOME directory. Check and make all the folder directories point to the right places. For instance, dags_folder = YOUR_AIRFLOW_HOME/dags
- 6B: configure openmetadata.yaml and update the airflowConfiguration section. See: https://docs.open-metadata.org/integrations/airflow/configure-airflow-in-the-openmetadata-server

## To run a metadata ingestion workflow with Airflow ingestion DAGs on Postgres data:

1. Prepare the Ingestion DAG:
To see a more complete tutorial on ingestion DAG, see https://docs.open-metadata.org/integrations/connectors/postgres/run-postgres-connector-with-the-airflow-sdk
To be brief, below is my own DAG. Copy & Paste the following into a python file (postgres_demo.py):

```
import pathlib
import json
from datetime import timedelta
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.config.common import load_config_file
from metadata.ingestion.api.workflow import Workflow
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
{
    "source":{
        "type": "postgres",
        "serviceName": "postgres_demo",
        "serviceConnection": {
            "config": {
                "type": "Postgres",
                "username": "postgres", (change to your username)
                "password": "postgres", (change to your password)
                "hostPort": "192.168.1.55:5432", (change to your hostPort)
                "database": "surveillance_hub" (change to your database)
            }
        },
        "sourceConfig":{
            "config": { (all of the following can switch to true or false)
                "enableDataProfiler": "true" or "false", 
                "markDeletedTables": "true" or "false",
                "includeTables": "true" or "false",
                "includeViews": "true" or "false",
                "generateSampleData": "true" or "false" 
            }
        }
    },      
    "sink":{
        "type": "metadata-rest",
        "config": {}
    },   
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "no-auth"
        }
    }
        
        
}
"""

def metadata_ingestion_workflow():
    workflow_config = json.loads(config)
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


with DAG(
    "sample_data",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    schedule_interval='*/5 * * * *', 
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )

if __name__ == "__main__":
    metadata_ingestion_workflow()
```

2. Run the DAG:
`
python postgres_demo.py
`

- Alternatively, we could run without Airflow SDK and with OpenMetadata's own methods. Run `metadata ingest -c /Your_Path_To_Json/.json`
The json configuration is exactly the same as the json configuration in the DAG.
- Or, we could also run it with `metadata ingest -c /Your_Path_To_Yaml/.yaml`
The yaml configuration would be the exact same except without the curly brackets and the double quotes.

## To run a profiler workflow on Postgres data
1. Prepare the DAG OR configure the yaml/json:
- To configure the quality tests in json/yaml, see https://docs.open-metadata.org/data-quality/data-quality-overview/tests
- To prepare the DAG, see https://github.com/open-metadata/OpenMetadata/tree/0.10.3-release/data-quality/data-quality-overview

Example yaml I was using:
```
source:
  type: postgres
  serviceName: your_service_name
  serviceConnection:
    config:
      type: Postgres
      username: your_username
      password: your_password
      hostPort: 
      database: your_database  
  sourceConfig:
    config:
      type: Profiler

processor:
  type: orm-profiler
  config:
    test_suite:
      name: demo_test
      tests:
        - table: your_table_name (FQN)
          column_tests:
            - columnName: id
              testCase:
                columnTestType: columnValuesToBeBetween
                config:
                  minValue: 0
                  maxValue: 10
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```
Note that the table name must be FQN and match exactly with the table path on the OpenMetadata UI.

2. Run it with 
`metadata profile -c /path_to_yaml/.yaml`

Make sure to refresh the OpenMetadata UI and click on the Data Quality tab to see the results.
