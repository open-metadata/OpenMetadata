---
description: In this section, we provide guides and reference to use the MLflow connector.
---

# MLflow

1. [Requirements](./#1.-requirements)
2. [Install MLflow Connector](./#2.-install-mlflow-connector)
3. [Configure MLflow Connector](./#3.-configure-bigquery-connector)
4. [Run MLflow Connector](./#4.-run-mlflow-connector)

## **1. Requirements**

Please ensure that your host system meets the requirements listed below.

### **OpenMetadata (version 0.9.0 or later)**

To deploy OpenMetadata, follow the procedure [Try OpenMetadata in Docker](../../../overview/run-openmetadata/).

### **Python (version 3.8.0 or later)**

Use the following command to check your Python version.

```
python3 --version
```

## 2. Install MLflow Connector

### **2.1 Prepare a Python virtual environment**

In this step, we’ll create a Python virtual environment. Using a virtual environment enables us to avoid conflicts with other Python installations and packages on your host system.

In a later step, you will install the Python module for this connector and its dependencies in this virtual environment.

#### **1 Create a directory for openmetadata**

Throughout the docs, we use a consistent directory structure for OpenMetadata services and connector installation. If you have not already done so by following another guide, please create an openmetadata directory now and change into that directory in your command line environment.

```
mkdir openmetadata; cd openmetadata
```

#### **2 Create a virtual environment**

Run the following command to create a Python virtual environment called, `env`. You can try multiple connectors in the same virtual environment.

```
python3 -m venv env
```

#### **3 Activate the virtual environment**

Run the following command to activate the virtual environment.

```
source env/bin/activate
```

Once activated, you should see your command prompt change to indicate that your commands will now be executed in the environment named `env`.

#### **4 Upgrade pip and setuptools to the latest versions**

Ensure that you have the latest version of pip by running the following command. If you have followed the steps above, this will upgrade pip in your virtual environment.

```javascript
pip3 install --upgrade pip setuptools
```

### **2.2 Install the Python module for this connector**

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for the MLflow connector.

```javascript
pip3 install 'openmetadata-ingestion[mlflow]'
```

## 3. Configure MLflow Connector

Please follow the steps relevant to your use case.

1. [Create a configuration file using template JSON](./#3.-create-a-configuration-file-using-template-json)
2. [Configure service settings](./#4.-configure-service-settings)
3. [Confirm sink settings](./#3.3-confirm-sink-settings)
4. [Confirm metadata\_server settings](./#3.4-confirm-metadata\_server-settings)

### **3.1 Create a configuration file using template JSON**

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

### **3.2 Configure service settings**

In this step we will configure the MLflow service settings required for this connector. Please follow the instructions below to ensure that you’ve configured the connector to read from your MLflow service as desired.

#### **tracking\_uri**

MLflow server containing the tracking information of runs and experiments ([docs](https://mlflow.org/docs/latest/tracking.html#)).

```json
"tracking_uri": "http://localhost:5000"
```

**registry\_uri**

Backend store where the Tracking Server stores experiment and run metadata ([docs](https://mlflow.org/docs/latest/tracking.html#id14)).

```json
"registry_uri": "mysql+pymysql://mlflow:password@localhost:3307/experiments"
```

### **3.3 Confirm `sink` settings**

You need not make any changes to the fields defined for `sink` in the template code you copied into `bigquery.json` in Step 3. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```

### **3.4 Confirm `metadata_server` settings**

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

## **4. Run MLflow Connector**

Your `mlflow.json` configuration file should now be fully configured and ready to use in an ingestion workflow.

To run an ingestion workflow, execute the following command from the `openmetadata` directory you created in Step 1.

```
metadata ingest -c ./mlflow.json
```

### **Setup MLflow connector in production (optional)**

If you already have a production Airflow instance on which you would like to schedule OpenMetadata ingestion workflows, follow the procedure [Ingest Metadata in Production](../../ingest-metadata-in-production.md).

## **Next Steps**

To view the metadata ingested from MLflow, visit [http://localhost:8585/explore/tables](http://localhost:8585/explore/tables). Select the MLflow service to filter for the data you’ve ingested using the workflow you configured and ran following this guide.

![](../../../.gitbook/assets/explore.png)

## **5. Troubleshooting**

### **ERROR: Failed building wheel for cryptography**

When attempting to install the `openmetadata-ingestion[mlfow]` Python package in Step 2, you might encounter the following error. The error might include a mention of a Rust compiler.

```
Failed to build cryptography
ERROR: Could not build wheels for cryptography which use PEP 517 and cannot be installed directly
```

```
pip3 install --upgrade pip setuptools
```

Then re-run the install command in [Step 2](./#2.-install-the-python-module-for-this-connector).

### **requests.exceptions.ConnectionError**

If you encounter the following error when attempting to run the ingestion workflow, this is probably because there is no OpenMetadata server running at http://localhost:8585.

```
requests.exceptions.ConnectionError: HTTPConnectionPool(host='localhost', port=8585): 
Max retries exceeded with url: /api/v1/services/databaseServices/name/mlflow 
(Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x1031fa310>: 
Failed to establish a new connection: [Errno 61] Connection refused'))
```

To correct this problem, follow the procedure [Try OpenMetadata in Docker](../../../overview/run-openmetadata/) to deploy OpenMetadata.

Then re-run the metadata ingestion workflow in [Run MLflow Connector](./#4.-run-mlflow-connector).
