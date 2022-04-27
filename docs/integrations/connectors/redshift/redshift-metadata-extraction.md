---
description: >-
  This guide will help you configure metadata ingestion workflows using the
  Redshift connector.
---

# Run Redshift Connector with the Airflow SDK

Configure and schedule Snowflake **metadata**, **usage**, and **profiler** workflows using your own Airflow instances



### &#x20;**Install the Python module for this connector**

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for this connector.

```javascript
pip3 install 'openmetadata-ingestion[redshift]'
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json) you can find the structure to create a connection to Snowflake.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a JSON configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).



### 1. Create a configuration file using template JSON

Create a new file called `redshift.json` in the current directory. Note that the current directory should be the `openmetadata` directory.

Copy and paste the configuration template below into the `redshift.json` the file you created.

{% code title="redshift.json" %}
```json
{
  "source": {
    "type": "redshift",
    "serviceName": "aws_redshift",
    "serviceConnection": {
      "config": {
        "type": "Redshift",
        "hostPort": "cluster.name.region.redshift.amazonaws.com:5439",
        "username": "username",
        "password": "strong_password",
        "database": "dev"
      }
    },
    "sourceConfig": {
        "config": {
            "enableDataProfiler": true or false,
            "markDeletedTables": true or false,
            "includeTables": true or false,
            "includeViews": true or false,
            "generateSampleData": true or false,
            "sampleDataQuery": "<query to fetch table data>",
            "schemaFilterPattern": "<schema name regex list>",
            "tableFilterPattern": "<table name regex list>",
            "dbtProvider": "<s3, gcs, gcs-path, local or http>",
            "dbtConfig": "<for the selected provider>",
            "dbtCatalogFileName": "<file name>",
            "dbtManifestFileName": "<file name>"
        }
     }
    },
    "sink": {
        "type": "metadata-rest",
        "config": {}
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "<OpenMetadata host and port>",
            "authProvider": "<OpenMetadata auth provider>"
        }
    }
}
```
{% endcode %}

### 2. Configure service settings

In this step, we will configure the Redshift service settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Redshift service as desired.



**hostPort**

Edit the value for `source.serviceConnection.hostPort` in `redshift.json` for your Redshift deployment. Use the `host:port` format illustrated in the example below.

```json
"hostPort": "cluster.name.region.redshift.amazonaws.com:5439"
```

Please ensure that your Redshift deployment is reachable from the host you are using to run metadata ingestion.



**username**

Edit the value `source.config.username` to identify your Redshift user.

```json
"username": "username"
```

{% hint style="danger" %}
Note: The user specified should be authorized to read all databases you want to include in the metadata ingestion workflow.
{% endhint %}



**password**

Edit the value for`source.config.password` with the password for your Redshift user.

```json
"password": "strong_password"
```



**service\_name**

OpenMetadata uniquely identifies services by their `service_name`. Edit the value for `source.serviceName` with a name that distinguishes this deployment from other services, including other Redshift services that you might be ingesting metadata from.

```json
"serviceName": "aws_redshift"
```



**database (optional)**

If you want to limit metadata ingestion to a single database, include the `source.config.serviceConnection.database` field in your configuration file. If this field is not included, the Redshift connector will ingest metadata from all databases that the specified user is authorized to read.

To specify a single database to ingest metadata from, provide the name of the database as the value for the `source.config.serviceConnection.database` key as illustrated in the example below.

```json
"database": "warehouse"
```

####

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

#### 10. Edit a Python script to define your ingestion DAG

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
    "openmetadata_redshift_connector",
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
