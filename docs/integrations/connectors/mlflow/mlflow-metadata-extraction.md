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

1. Prepare a Python virtual environment
2. Install the Python module for this connector
3. Create a configuration file using template JSON
4. Configure service settings
5. Confirm sink settings
6. Confirm metadata\_server settings
7. Edit a Python script to define your ingestion DAG
8. Copy your configuration JSON into the ingestion script
9. Run the script to create your ingestion DAG



### **1. Prepare a Python virtual environment**

In this step, we’ll create a Python virtual environment. Using a virtual environment enables us to avoid conflicts with other Python installations and packages on your host system.

In a later step, you will install the Python module for this connector and its dependencies in this virtual environment.

#### **1.1 Create a directory for openmetadata**

Throughout the docs, we use a consistent directory structure for OpenMetadata services and connector installation. If you have not already done so by following another guide, please create an openmetadata directory now and change into that directory in your command line environment.

```
mkdir openmetadata; cd openmetadata
```

#### **1.2 Create a virtual environment**

Run the following command to create a Python virtual environment called, `env`. You can try multiple connectors in the same virtual environment.

```
python3 -m venv env
```

#### **1.3 Activate the virtual environment**

Run the following command to activate the virtual environment.

```
source env/bin/activate
```

Once activated, you should see your command prompt change to indicate that your commands will now be executed in the environment named `env`.

#### **1.4 Upgrade pip and setuptools to the latest versions**

Ensure that you have the latest version of pip by running the following command. If you have followed the steps above, this will upgrade pip in your virtual environment.

```javascript
pip3 install --upgrade pip setuptools
```

****

### **2. Install the Python module for this connector**

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for this connector.

```javascript
pip3 install 'openmetadata-ingestion[mlflow]'
```



### **3. Create a configuration file using template JSON**

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

### **4. Configure service settings**

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

****

### **5. Confirm `sink` settings**

You need not make any changes to the fields defined for `sink` in the template code you copied into `bigquery.json` in Step 3. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```



### **6. Confirm `metadata_server` settings**

You need not make any changes to the fields defined for `metadata_server` in the template code you copied into `bigquery.json` in Step 3. This part of your configuration file should be as follows.

```javascript
"metadata_server": {
    "type": "metadata-server",
    "config": {
        "api_endpoint": "http://localhost:8585/api",
        "auth_provider_type": "no-auth"
    }
}
```



### 7. Edit a Python script to define your ingestion DAG

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



### 8. Copy your configuration JSON into the ingestion script

In steps 3 - 6 above you created a JSON file with the configuration for your ingestion connector. Copy that JSON into the `openmetadata-airflow.py` file that you created in step 7 as directed by the comment below.

```
config = """
  ## REPLACE THIS LINE WITH YOUR CONFIGURATION JSON
"""
```



### 9. Run the script to create your ingestion DAG

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

1. Prepare a Python virtual environment
2. Install the Python module for this connector
3. Create a configuration file using template JSON
4. Configure service settings
5. Confirm sink settings
6. Confirm metadata\_server settings
7. Run the ingestion workflow



### **1. Prepare a Python virtual environment**

In this step, we’ll create a Python virtual environment. Using a virtual environment enables us to avoid conflicts with other Python installations and packages on your host system.

In a later step, you will install the Python module for this connector and its dependencies in this virtual environment.

#### **1.1 Create a directory for openmetadata**

Throughout the docs, we use a consistent directory structure for OpenMetadata services and connector installation. If you have not already done so by following another guide, please create an openmetadata directory now and change into that directory in your command line environment.

```
mkdir openmetadata; cd openmetadata
```

#### **1.2 Create a virtual environment**

Run the following command to create a Python virtual environment called, `env`. You can try multiple connectors in the same virtual environment.

```
python3 -m venv env
```

#### **1.3 Activate the virtual environment**

Run the following command to activate the virtual environment.

```
source env/bin/activate
```

Once activated, you should see your command prompt change to indicate that your commands will now be executed in the environment named `env`.

#### **1.4 Upgrade pip and setuptools to the latest versions**

Ensure that you have the latest version of pip by running the following command. If you have followed the steps above, this will upgrade pip in your virtual environment.

```javascript
pip3 install --upgrade pip setuptools
```

****

### **2. Install the Python module for this connector**

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for this connector.

```javascript
pip3 install 'openmetadata-ingestion[mlflow]'
```



### **3. Create a configuration file using template JSON**

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

### **4. Configure service settings**

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

### **5. Confirm `sink` settings**

You need not make any changes to the fields defined for `sink` in the template code you copied into `bigquery.json` in Step 3. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```



### **6. Confirm `metadata_server` settings**

You need not make any changes to the fields defined for `metadata_server` in the template code you copied into `bigquery.json` in Step 3. This part of your configuration file should be as follows.

```javascript
"metadata_server": {
    "type": "metadata-server",
    "config": {
        "api_endpoint": "http://localhost:8585/api",
        "auth_provider_type": "no-auth"
    }
}
```



### **7. Run ingestion workflow**

Your `mlflow.json` configuration file should now be fully configured and ready to use in an ingestion workflow.

To run an ingestion workflow, execute the following command from the `openmetadata` directory.

```
metadata ingest -c ./mlflow.json
```

## Troubleshooting

### **requests.exceptions.ConnectionError**

If you encounter the following error when attempting to run the ingestion workflow in Step 7, this is probably because there is no OpenMetadata server running at http://localhost:8585.

```
requests.exceptions.ConnectionError: HTTPConnectionPool(host='localhost', port=8585): 
Max retries exceeded with url: /api/v1/services/databaseServices/name/bigquery 
(Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x1031fa310>: 
Failed to establish a new connection: [Errno 61] Connection refused'))
```

To correct this problem, please follow the steps in the [Run OpenMetadata](https://docs.open-metadata.org/v/main/try-openmetadata/run-openmetadata) guide to deploy OpenMetadata in Docker on your local machine.

Then re-run the metadata ingestion workflow in Step 7.
{% endtab %}
{% endtabs %}
