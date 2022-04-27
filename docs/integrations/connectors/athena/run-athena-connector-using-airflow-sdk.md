# Run Athena Connector using Airflow SDK



Configure and schedule Snowflake **metadata**, **usage**, and **profiler** workflows using your own Airflow instances



### &#x20;**Install the Python module for this connector**

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for this connector.

```javascript
pip3 install 'openmetadata-ingestion[athena]'
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json) you can find the structure to create a connection to Snowflake.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a JSON configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).



### 1. Create a configuration file using template JSON

Create a new file called `athena.json` in the current directory. Note that the current directory should be the `openmetadata` directory.

Copy and paste the configuration template below into the `athena.json` the file you created.

{% code title="athena.json" %}
```json
{
    "source": {
        "type": "athena",
        "serviceName": "local_athena",
        "serviceConnection": {
            "config": {
                "type": "Athena",
                "database": "database_name",
                "awsConfig": {
                    "awsAccessKeyId": "access key id",
                    "awsSecretAccessKey": "access secret key",
                    "awsRegion": "aws region name"
                },
                "s3StagingDir": "s3 directory for datasource",
                "workgroup": "workgroup name"
            }
        },
        "sourceConfig": {
            "config": {
                "enableDataProfiler": false
            }
        }
    },
    "sink": {
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
```
{% endcode %}

### 2. Configure service settings

In this step, we will configure the Athena service settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Athena service as desired.

#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json).

* **enableDataProfiler**: **** `true` or `false`, to run the profiler (not the tests) during the metadata ingestion.
* **markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.
* **includeTables**: `true` or `false`, to ingest table data. Default is true.
* **includeViews**: `true` or `false`, to ingest views definitions.
* **generateSampleData**: To ingest sample data based on `sampleDataQuery`.
* **sampleDataQuery**: Defaults to `select * from {}.{} limit 50`.
* **schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

```
"tableFilterPattern": {
  "includes": ["users", "type_test"]
}
```

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `"type": "metadata-rest"`.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```
"workflowConfig": {
  "openMetadataServerConfig": {
    "hostPort": "http://localhost:8585/api",
    "authProvider": "no-auth"
  }
}
```

#### OpenMetadata Security Providers

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/security/client). An example of an Auth0 configuration would be the following:

```
"workflowConfig": {
    "openMetadataServerConfig": {
        "hostPort": "http://localhost:8585/api",
        "authProvider": "auth0",
        "securityConfig": {
            "clientId": "<client ID>",
            "secretKey": "<secret key>",
            "domain": "<domain>"
        }
    }
}
```

#### &#x20;Edit a Python script to define your ingestion DAG

Copy and paste the code below into a file called `openmetadata-airflow.py`.

```python
import json
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
    workflow_config = json.loads(config)
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
