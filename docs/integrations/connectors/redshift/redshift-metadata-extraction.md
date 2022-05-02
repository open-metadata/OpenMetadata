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

* **hostPort**: **** Host and port of the data source.
* **username** (Optional): Specify the User to connect to Redshift. It should have enough privileges to read all the metadata.
* **password** (Optional): Connection password.
* **database** (Optional): The database of the data source is an optional parameter if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
* **connectionOptions** (Optional): Enter the details for any additional connection options that can be sent to Trino during the connection. These details must be added as Key-Value pairs.
* **connectionArguments** (Optional): Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Trino during the connection. These details must be added as Key-Value pairs.

You can configure SSL options for the Redshift connection as `connectionArguments`. The key should be `sslmode` and accepts the following values:

* `verify-ca`: The Redshift connector will verify that the server is trustworthy by checking the certificate chain up to a trusted certificate authority (CA).
* `verify-full`: The Redshift connector will also verify that the server hostname matches its certificate. The SSL connection will fail if the server certificate cannot be verified. `verify-full` is recommended in most security-sensitive environments.
* `require`: If a root CA file exists, the behavior of `sslmode=require` will be the same as that of `verify-ca`, meaning the server certificate is validated against the CA. Relying on this behavior is discouraged, and applications that need certificate validation should always use `verify-ca` or `verify-full`.&#x20;

In `verify-full` mode, the cn (Common Name) attribute of the certificate is matched against the hostname. If the cn attribute starts with an asterisk (\*), it will be treated as a wildcard, and will match all characters except a dot (.). This means the certificate will not match subdomains. If the connection is made using an IP address instead of a hostname, the IP address will be matched (without doing any DNS lookups).

You can find more information in the AWS [docs](https://docs.aws.amazon.com/redshift/latest/mgmt/connecting-ssl-support.html).

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
