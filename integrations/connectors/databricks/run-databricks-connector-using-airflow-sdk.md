---
description: Use your own Airflow instance to schedule and run the Databricks Connector.
---

# Run Databricks Connector using Airflow SDK

Configure and schedule Databricks **metadata** and **profiler** workflows using your own Airflow instances.

* [Requirements](run-databricks-connector-using-airflow-sdk.md#requirements)
* [Metadata Ingestion](run-databricks-connector-using-airflow-sdk.md#metadata-ingestion)
* [Data Profiler and Quality Tests](run-databricks-connector-using-airflow-sdk.md#data-profiler-and-quality-tests)
* [DBT Integration](run-databricks-connector-using-airflow-sdk.md#dbt-integration)

## Requirements

Follow this [guide](../../airflow/) to learn how to set up Airflow to run the metadata ingestions.

### **Install the Python module for this connector**

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for this connector.

```javascript
pip3 install 'openmetadata-ingestion[databricks]'
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/databricksConnection.json) you can find the structure to create a connection to Databricks.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a JSON configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Create a configuration file using template JSON

Create a new file called `databricks.json` in the current directory. Note that the current directory should be the `openmetadata` directory.

Copy and paste the configuration template below into the `databricks.json` the file you created.

{% code title="databrick.json" %}
```json
{
  "source": {
    "type": "databricks",
    "serviceName": "local_databricks",
    "serviceConnection": {
      "config": {
        "type":"Databricks",
        "token": "<databricks token>",
        "database":"<database>",
        "hostPort": "<databricks connection host & port>",
        "httpPath": "<http path of databricks cluster>"
      }
    },
    "sourceConfig": {
      "config": {
          "markDeletedTables": true or false,
          "includeTables": true or false,
          "includeViews": true or false,
          "schemaFilterPattern": "<schema name regex list>",
          "tableFilterPattern": "<table name regex list>",
          "dbtConfigSource": "<configs for gcs, s3, local or file server to get the DBT files"
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

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/databricksConnection.json).

* **token**: Enter the generated token to connect to Databricks.
* **hostPort**: Enter the fully qualified hostname and port number for your Hive deployment in the _Host and Port_ field.
* **database**: If you want to limit metadata ingestion to a single database, enter the name of this database in the Database field. If no value is entered for this field, the connector will ingest metadata from all databases that the specified user is authorized to read.
* **httpPath**: Enter the http path of Databricks cluster.
* **connectionOptions** (Optional): Enter the details for any additional connection options that can be sent to Databricks during the connection. These details must be added as Key-Value pairs.
* **connectionArguments** (Optional): Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Databricks during the connection. These details must be added as Key-Value pairs.

To specify LDAP Auth, use the following `connectionArguments`:

```
"connectionArguments": {
"auth": "LDAP"
}
```

In this step, we will configure the Hive service settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Hive service as desired.

#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json).

* **markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.
* **includeTables**: `true` or `false`, to ingest table data. Default is true.
* **includeViews**: `true` or `false`, to ingest views definitions.
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

#### Edit a Python script to define your ingestion DAG

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

## Data Profiler and Quality Tests

The Data Profiler workflow will be using the `orm-profiler` processor. While the `serviceConnection` will still be the same to reach the source system, the `sourceConfig` will be updated from previous configurations.

### 1. Define the JSON configuration

This is a sample config for a Databricks profiler:

```json
{
  "source": {
    "type": "databricks",
    "serviceName": "local_databricks",
    "serviceConnection": {
      "config": {
        "type":"Databricks",
        "token": "<databricks token>",
        "database":"<database>",
        "hostPort": "<databricks connection host & port>",
        "httpPath": "<http path of databricks cluster>"
      }
    },
    "sourceConfig": {
      "config": {
          "markDeletedTables": true or false,
          "includeTables": true or false,
          "includeViews": true or false,
          "schemaFilterPattern": "<schema name regex list>",
          "tableFilterPattern": "<table name regex list>",
          "dbtConfigSource": "<configs for gcs, s3, local or file server to get the DBT files"
        }
      }
  },
  "processor": {
    "type": "orm-profiler",
    "config": {}
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

#### Source Configuration

* You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/databricksConnection.json).
* The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json). If you don't need to add any `fqnFilterPattern`, the `"type": "Profiler"` is still required to be present.

Note that the `fqnFilterPattern` supports regex as `include` or `exclude`. E.g.,

```
"fqnFilterPattern": {
  "includes": ["service.database.schema.*"]
}
```

#### Processor

To choose the `orm-profiler`. It can also be updated to define tests from the JSON itself instead of the UI:

```json
 "processor": {
    "type": "orm-profiler",
    "config": {
        "test_suite": {
            "name": "<Test Suite name>",
            "tests": [
                {
                    "table": "<Table FQN>",
                    "table_tests": [
                        {
                            "testCase": {
                                "config": {
                                    "value": 100
                                },
                                "tableTestType": "tableRowCountToEqual"
                            }
                        }
                    ],
                    "column_tests": [
                        {
                            "columnName": "<Column Name>",
                            "testCase": {
                                "config": {
                                    "minValue": 0,
                                    "maxValue": 99
                                },
                                "columnTestType": "columnValuesToBeBetween"
                            }
                        }
                    ]
                }
            ]
        }
     }
  },
```

`tests` is a list of test definitions that will be applied to `table`, informed by its FQN. For each table, one can then define a list of `table_tests` and `column_tests`. Review the supported tests and their definitions to learn how to configure the different cases [here](../../../data-quality/data-quality-overview/tests.md).

#### Workflow Configuration

The same as the [metadata](run-databricks-connector-using-airflow-sdk.md#workflow-configuration) ingestion.

### 2. Run with the CLI

Again, we will start by saving the JSON file.

Then, we can run the workflow as:

```
metadata profile -c <path-to-json>
```

Note how instead of running `ingest`, we are using the `profile` command to select the `Profiler` workflow.

## DBT Integration

You can learn more about how to ingest DBT models' definitions and their lineage [here](../../../data-lineage/dbt-integration/).
