---
description: >-
  This guide will help you configure metadata ingestion workflows using the
  MLflow connector.
---

# MLflow Metadata Extraction

There are two options for configuring metadata ingestion for this connector. They are as follows:

1. Schedule metadata ingestion workflows via the **Airflow SDK**. Use this option if you already have an Airflow instance running that you plan to use for workflow scheduling with OpenMetadata.
2. Use the OpenMetadata ingestion Python module to perform a **One-time Ingestion**. Use this option if you want to perform a trial of OpenMetadata in a test environment

{% hint style="info" %}
Note that the MLflow connector only extracts the data that is available in the service, such as the models and their features. However, OpenMetadata goes one step further when defining ML Models, therefore it is encouraged to add further information on top of this using the [Python API](../../../openmetadata-apis/schemas/entities/mlmodel.md).
{% endhint %}

Please select the approach you would prefer to use for metadata ingestion from the tabs below.

{% tabs %}
{% tab title="Airflow SDK" %}
## Schedule Ingestion via the Airflow SDK <a href="#mysql-connector-airflow-sdk" id="mysql-connector-airflow-sdk"></a>

## Requirements

Using the OpenMetadata MySQL connector requires supporting services and software. Please ensure that your host system meets the requirements listed below. Then continue to follow the procedure for installing and configuring this connector.



### OpenMetadata (version 0.8.0 or later)

You must have a running deployment of OpenMetadata to use this guide. OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Airflow for metadata ingestion workflows



### Python (version 3.8.0 or later)

Please use the following command to check the version of Python you have.

```
python3 --version
```

## Procedure

Here’s an overview of the steps in this procedure. Please follow the steps relevant to your use case.

1. Create a configuration file using template JSON
2. Configure service settings
3. Confirm sink settings
4. Confirm metadata\_server settings
5. Install the OpenMetadata MLflow Python module
6. Edit a Python script to define your ingestion DAG
7. Copy your configuration JSON into the ingestion script
8. Run the script to create your ingestion DAG

### 1**. Create a configuration file using template JSON**

Create a new file called `mlflow.json` in the current directory. Note that the current directory should be the `openmetadata` directory.

Copy and paste the configuration template below into the `mlflow.json` file you created.

{% hint style="info" %}
Note: The `source.config` field in the configuration JSON will include the majority of the settings for your connector. In the steps below we describe how to customize the key-value pairs in the `source.config` field to meet your needs.
{% endhint %}

{% code title="mlflow.json" %}
```json
{
  "source": {
    "type": "mlflow",
    "config": {
      "tracking_uri": "http://localhost:5000",
      "registry_uri": "mysql+pymysql://mlflow:password@localhost:3307/experiments"
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
    }
  }
}
```
{% endcode %}

### ****

### **2. Configure service settings**

In this step we will configure the MLflow service settings required for this connector. Please follow the instructions below to ensure that you’ve configured the connector to read from your MLflow service as desired.

****

#### **tracking\_uri**

MLflow server containing the tracking information of runs and experiments ([docs](https://mlflow.org/docs/latest/tracking.html#)).

```json
"tracking_uri": "http://localhost:5000"
```

****

**registry\_uri**

Backend store where the Tracking Server stores experiment and run metadata ([docs](https://mlflow.org/docs/latest/tracking.html#id14)).

```json
"registry_uri": "mysql+pymysql://mlflow:password@localhost:3307/experiments"
```

### ****

### **3. Confirm `sink` settings**

You need not make any changes to the fields defined for `sink` in the template code you copied into `bigquery.json` in Step 1. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```



### **4. Confirm `metadata_server` settings**

You need not make any changes to the fields defined for `metadata_server` in the template code you copied into `bigquery.json` in Step 1. This part of your configuration file should be as follows.

```javascript
"metadata_server": {
    "type": "metadata-server",
    "config": {
        "api_endpoint": "http://localhost:8585/api",
        "auth_provider_type": "no-auth"
    }
}
```



### 5. Install the OpenMetadata Airflow Python module

Install the OpenMetadata Airflow Python module by running the following command.

```bash
pip3 install --upgrade 'openmetadata-ingestion[mlflow]'
```



### 6. Edit a Python script to define your ingestion DAG

Copy and paste the code below into a file called `openmetadata-airflow.py`.&#x20;

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
    "sample_data",
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



### 7. Copy your configuration JSON into the ingestion script

In steps 1 - 8 above you created a JSON file with the configuration for your ingestion connector. Copy that JSON into the `openmetadata-airflow.py` file that you created in step 9 as directed by the comment below.

```
config = """
  ## REPLACE THIS LINE WITH YOUR CONFIGURATION JSON
"""
```



### 8. Run the script to create your ingestion DAG

Run the following command to create your ingestion DAG in Airflow.

```
python openmetadata-airflow.py
```
{% endtab %}

{% tab title="One-time Ingestion" %}
## One-time Ingestion <a href="#mysql-connector-airflow-sdk" id="mysql-connector-airflow-sdk"></a>

## Requirements

Using the OpenMetadata MySQL connector requires supporting services and software. Please ensure that your host system meets the requirements listed below. Then continue to follow the procedure for installing and configuring this connector.



### OpenMetadata (version 0.8.0 or later)

You must have a running deployment of OpenMetadata to use this guide. OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Airflow for metadata ingestion workflows



### Python (version 3.8.0 or later)

Please use the following command to check the version of Python you have.

```
python3 --version
```

## Procedure

Here’s an overview of the steps in this procedure. Please follow the steps relevant to your use case.

1. Create a configuration file using template JSON
2. Configure service settings
3. Confirm sink settings
4. Confirm metadata\_server settings
5. Install the OpenMetadata MLflow Python module
6. Run the ingestion workflow

### 1**. Create a configuration file using template JSON**

Create a new file called `mlflow.json` in the current directory. Note that the current directory should be the `openmetadata` directory.

Copy and paste the configuration template below into the `mlflow.json` file you created.

{% hint style="info" %}
Note: The `source.config` field in the configuration JSON will include the majority of the settings for your connector. In the steps below we describe how to customize the key-value pairs in the `source.config` field to meet your needs.
{% endhint %}

{% code title="mlflow.json" %}
```json
{
  "source": {
    "type": "mlflow",
    "config": {
      "tracking_uri": "http://localhost:5000",
      "registry_uri": "mysql+pymysql://mlflow:password@localhost:3307/experiments"
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
    }
  }
}
```
{% endcode %}

### ****

### **2. Configure service settings**

In this step we will configure the MLflow service settings required for this connector. Please follow the instructions below to ensure that you’ve configured the connector to read from your MLflow service as desired.

****

#### **tracking\_uri**

MLflow server containing the tracking information of runs and experiments ([docs](https://mlflow.org/docs/latest/tracking.html#)).

```json
"tracking_uri": "http://localhost:5000"
```

****

**registry\_uri**

Backend store where the Tracking Server stores experiment and run metadata ([docs](https://mlflow.org/docs/latest/tracking.html#id14)).

```json
"registry_uri": "mysql+pymysql://mlflow:password@localhost:3307/experiments"
```

### ****

### **3. Confirm `sink` settings**

You need not make any changes to the fields defined for `sink` in the template code you copied into `bigquery.json` in Step 1. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```



### **4. Confirm `metadata_server` settings**

You need not make any changes to the fields defined for `metadata_server` in the template code you copied into `bigquery.json` in Step 1. This part of your configuration file should be as follows.

```javascript
"metadata_server": {
    "type": "metadata-server",
    "config": {
        "api_endpoint": "http://localhost:8585/api",
        "auth_provider_type": "no-auth"
    }
}
```



### 5. Install the OpenMetadata MLflow Python module

Install the OpenMetadata Airflow Python module by running the following command.

```bash
pip3 install --upgrade 'openmetadata-ingestion[mlflow]'
```



### **6. Run ingestion workflow**

Your `mlflow.json` configuration file should now be fully configured and ready to use in an ingestion workflow.

To run an ingestion workflow, execute the following command from the `openmetadata` directory.

```
metadata ingest -c ./mlflow.json
```

## Troubleshooting

### **requests.exceptions.ConnectionError**

If you encounter the following error when attempting to run the ingestion workflow in Step 9, this is probably because there is no OpenMetadata server running at http://localhost:8585.

```
requests.exceptions.ConnectionError: HTTPConnectionPool(host='localhost', port=8585): 
Max retries exceeded with url: /api/v1/services/databaseServices/name/bigquery 
(Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x1031fa310>: 
Failed to establish a new connection: [Errno 61] Connection refused'))
```

To correct this problem, please follow the steps in the [Run OpenMetadata](https://docs.open-metadata.org/v/main/try-openmetadata/run-openmetadata) guide to deploy OpenMetadata in Docker on your local machine.

Then re-run the metadata ingestion workflow in Step 6.
{% endtab %}
{% endtabs %}
