# Snowflake via Airflow SDK

Schedule metadata ingestion workflows via the Airflow SDK. Use this option if you already have an Airflow instance running that you plan to use for workflow scheduling with OpenMetadata.

1. [Requirements](snowflake-via-airflow-sdk.md#1.-confirm-your-system-meets-requirements)
2. [Install Snowflake Connector](snowflake-via-airflow-sdk.md#install-snowflake-connector)
3. [Configure Snowflake Connector](snowflake-via-airflow-sdk.md#3.-configure-snowflake-connector)
4. [Run Snowflake Connector](snowflake-via-airflow-sdk.md#run-manually)
5. [Troubleshooting](snowflake-via-airflow-sdk.md#5.-troubleshooting)

## 1. R**equirements**

Please ensure that your host system meets the requirements listed below.

### **OpenMetadata (version 0.10 or later)**

To deploy OpenMetadata, follow the procedure [Try OpenMetadata in Docker](../../../overview/run-openmetadata/).

### **Python (version 3.8.0 or later)**

Use the following command to check your Python version.

```
python3 --version
```

## **2. Install Snowflake Connector**

### **2.1. Prepare a Python virtual environment**

If you have not already set up a Python virtual environment by following another guide. Follow the steps below. Otherwise, skip to [step 2.2](snowflake-via-airflow-sdk.md#2.2-install-the-python-module-for-this-connector).

Using a virtual environment enables us to avoid conflicts with other Python installations and packages on your host system.

In a later step, you will install the Python module for this connector and its dependencies in this virtual environment.

#### **2.1.1 Create a directory called `openmetadata`**

Create an openmetadata directory now and change into that directory in your command line environment.

```
mkdir openmetadata; cd openmetadata
```

#### **2.1.2 Create a virtual environment**

Run the following command to create a Python virtual environment called, `env`. You can try multiple connectors in the same virtual environment.

```
python3 -m venv env
```

#### **2.1.3 Activate the virtual environment**

Run the following command to activate the virtual environment.

```
source env/bin/activate
```

Once activated, you should see your command prompt change to indicate that your commands will now be executed in the environment named `env`.

#### **2.1.4 Upgrade pip and setuptools to the latest versions**

Ensure that you have the latest version of pip by running the following command. If you have followed the steps above, this will upgrade pip in your virtual environment.

```javascript
pip3 install --upgrade pip setuptools
```

### **2.2 Install the Python module for this connector**

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for this connector.

```javascript
pip3 install --upgrade 'openmetadata-ingestion[snowflake]'
```

## 3. Configure Snowflake Connector

1. [Create a configuration file using template JSON](snowflake-via-airflow-sdk.md#3.1-create-a-configuration-file-using-template-json)
2. [Configure service settings](snowflake-via-airflow-sdk.md#4.-configure-service-settings)
3. [Enable the data profiler (optional)](snowflake-via-airflow-sdk.md#3.3-enable-disable-the-data-profiler)
4. [Install the data profiler Python module (optional)](snowflake-via-airflow-sdk.md#3.4-install-the-data-profiler-python-module-optional)
5. [Configure data filters (optional)](snowflake-via-airflow-sdk.md#3.3.-configure-data-filters-optional)
6. [Configure sample data (optional)](snowflake-via-airflow-sdk.md#3.4.-configure-sample-data-optional)
7. [Configure DBT (optional)](snowflake-via-airflow-sdk.md#3.5.-configure-dbt-optional)
8. [Confirm sink settings](snowflake-via-airflow-sdk.md#3.6.-confirm-sink-settings)
9. [Confirm workflowConfig settings](snowflake-via-airflow-sdk.md#3.9.-confirm-workflowconfig-settings)

### 3.1 Create a configuration file using template JSON

Create a new file called `snowflake.json`, then copy and paste the configuration JSON from one of the template options below. Your choice depends on how you will authenticate to Snowflake.

#### Option 1: Authenticate with SSO using an external browser popup

Use this method to test metadata ingestion on a Snowflake instance to which you authenticate using single-sign-on (SSO). This method will pop up a browser window to enable you to authenticate using your SSO method.

To use this method, copy and paste the template JSON below into your `snowflake.json` file.

```javascript
{
  "source": {
    "type": "snowflake",
    "serviceName": "snowflake",
    "serviceConnection": {
      "config": {
        "type": "Snowflake",
        "hostPort": "",
        "username": "testopenmetadata",
        "password": "password",
        "database": "SNOWFLAKE_SAMPLE_DATA",
        "warehouse": "COMPUTE_WH",
        "account": "",
        "scheme": "snowflake",
        "role": null,
        "connectionOptions": {
        },
        "connectionArguments": {
        "authenticator": "externalbrowser"
      },
        "supportsMetadataExtraction": true,
        "supportsUsageExtraction": true
      }
    },
    "sourceConfig": {
      "config": {
        "schemaFilterPattern": {
          "excludes": [
            "TPCH_SF1000"
          ]
        },
        "tableFilterPattern": {
          "excludes": [
            "CUSTOMER"
          ]
        }
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

#### Option 2: Authenticate with SSO specifying provider, username, and password

Use this method to test metadata ingestion on a Snowflake instance to which you authenticate using single-sign-on (SSO). Using this method, you will specify a url for your authentication provider and a username and password that will authenticate against this provider.

To use this method, copy and paste the template JSON below into your `snowflake.json` file.

```javascript
{
  "source": {
    "type": "snowflake",
    "serviceName": "snowflake",
    "serviceConnection": {
      "config": {
        "type": "Snowflake",
        "hostPort": "",
        "username": "testopenmetadata",
        "password": "password",
        "database": "SNOWFLAKE_SAMPLE_DATA",
        "warehouse": "COMPUTE_WH",
        "account": "",
        "scheme": "snowflake",
        "role": null,
        "connectionOptions": {
        },
        "connectionArguments": {
        "authenticator": "https://something.okta.com/"
      },
        "supportsMetadataExtraction": true,
        "supportsUsageExtraction": true
      }
    },
    "sourceConfig": {
      "config": {
        "schemaFilterPattern": {
          "excludes": [
            "TPCH_SF1000"
          ]
        },
        "tableFilterPattern": {
          "excludes": [
            "CUSTOMER"
          ]
        }
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

#### Option 3: Authenticate with username and password

Use this method to test metadata ingestion on a Snowflake instance to which you authenticate using a username and password.

To use this method, copy and paste the template JSON below into your `snowflake.json` file.

```javascript
{
  "source": {
    "type": "snowflake",
    "serviceName": "snowflake",
    "serviceConnection": {
      "config": {
        "type": "Snowflake",
        "hostPort": "",
        "username": "testopenmetadata",
        "password": "password",
        "database": "SNOWFLAKE_SAMPLE_DATA",
        "warehouse": "COMPUTE_WH",
        "account": "",
        "scheme": "snowflake",
        "role": null,
        "connectionOptions": {
        },
        "connectionArguments": {
        },
        "supportsMetadataExtraction": true,
        "supportsUsageExtraction": true
      }
    },
    "sourceConfig": {
      "config": {
        "schemaFilterPattern": {
          "excludes": [
            "TPCH_SF1000"
          ]
        },
        "tableFilterPattern": {
          "excludes": [
            "CUSTOMER"
          ]
        }
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

### 3.2. Configure service settings

In this step we will configure the Snowflake service settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Snowflake service as desired.

#### host\_port

Edit the value for `source.config.host_port` in `snowflake.json` for your Snowflake deployment. Use the `host:port` format illustrated in the example below.

```json
"hostPort": "account.region.service.snowflakecomputing.com"
```

Please ensure that your Snowflake deployment is reachable from the host you are using to run metadata ingestion.

#### username

Edit the value for `source.config.username` to identify your Snowflake user.

```json
"username": "username",
```

{% hint style="danger" %}
Note: The user specified should be authorized to read all databases you want to include in the metadata ingestion workflow.
{% endhint %}

#### password

Edit the value for `source.config.password` with the password for your Snowflake user.

```json
"password": "password",
```

#### warehouse

Edit the value for `source.config.warehouse` with the name of the Snowflake warehouse from which you want to ingest metadata.

```json
"warehouse": "COMPUTE_WH",
```

#### database

If you want to limit metadata ingestion to a single database, include the `source.config.database` field in your configuration file. If this field is not included, the connector will ingest metadata from all databases that the specified user is authorized to read.

To specify a single database to ingest metadata from, provide the name of the database as the value for the `source.config.database` key as illustrated in the example below.

```json
"database": "SNOWFLAKE_SAMPLE_DATA",
```

#### account

Edit the value for `source.config.account` with your Snowflake account identifier.

```json
"account": "account",
```

#### serviceName

OpenMetadata uniquely identifies services by their `serviceName`. Edit the value for `source.config.serviceName` with a name that distinguishes this deployment from other services, including other Snowflake services that you might be ingesting metadata from.

```json
"serviceName": "snowflake",
```

### **3.3 Enable the data profiler (optional)**

The data profiler ingests usage information for tables. This enables you to assess the frequency of use, reliability, and other details.

#### enableDataProfiler

When enabled, the data profiler will run as part of metadata ingestion. Running the data profiler increases the amount of time it takes for metadata ingestion, but provides the benefits mentioned above.

You may disable the data profiler by setting the value for the key `source.config.enableDataProfiler` to `"false"` as follows. We’ve done this in the configuration template provided.

```javascript
"enableDataProfiler": "false"
```

If you want to enable the data profiler, update your configuration file as follows.

```javascript
"enableDataProfiler": "true"
```

{% hint style="info" %}
**Note:** The data profiler is disabled by default if no setting is provided for enableDataProfiler
{% endhint %}

### **3.4 Install the data profiler Python module (optional)**

If you’ve enabled the data profiler in Step 3.3, run the following command to install the Python module for the data profiler. You’ll need this to run the ingestion workflow.

```javascript
pip3 install 'openmetadata-ingestion[data-profiler]'
```

The data profiler module takes a few minutes to install. While it installs, continue through the remaining steps in this guide.

### 3.5. Configure data filters (optional)

#### includeViews (optional)

Use `source.config.includeViews` to control whether or not to include views as part of metadata ingestion and data profiling.

Explicitly include views by adding the following key-value pair in the `source.config` field of your configuration file.

```json
"includeViews": "true"
```

Exclude views as follows.

```json
"includeViews": "false"
```

{% hint style="info" %}
Note: `source.config.includeViews` is set to `true` by default.
{% endhint %}

#### includeTables (optional)

Use `source.config.includeTables` to control whether or not to include tables as part of metadata ingestion and data profiling.

Explicitly include tables by adding the following key-value pair in the `source.config` field of your configuration file.

```json
"includeTables": "true"
```

Exclude tables as follows.

```json
"includeTables": "false"
```

{% hint style="info" %}
Note: `source.config.includeTables` is set to `true` by default.
{% endhint %}

#### tableFilterPattern (optional)

Use `source.config.tableFilterPattern` to select tables for metadata ingestion by name.

Use `source.config.tableFilterPattern.excludes` to exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included. See below for an example. This example is also included in the configuration template provided.

```json
"tableFilterPattern": {
    "excludes": ["information_schema.*", "[\\w]*event_vw.*"]
}
```

Use `source.config.tableFilterPattern.includes` to include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded. See below for an example.

```json
"tableFilterPattern": {
    "includes": ["corp.*", "dept.*"]
}
```

See the documentation for the [Python re module](https://docs.python.org/3/library/re.html) for information on how to construct regular expressions.

{% hint style="info" %}
You may use either `excludes` or `includes` but not both in `tableFlterPattern.`
{% endhint %}

#### schemaFilterPattern (optional)

Use `source.config.schemaFilterPattern.excludes` and `source.config.schemaFilterPattern.includes` field to select the schemas for metadata ingestion by name. The configuration template provides an example.

The syntax and semantics for `schemaFilterPattern` are the same as for [`tableFilterPattern`](snowflake-via-airflow-sdk.md#table\_filter\_pattern-optional). Please check that section (immediately above) for details.

### 3.6. Configure sample data (optional)

#### generateSampleData (optional)

Use the `source.config.generateSampleData` field to control whether or not to generate sample data to include in table views in the OpenMetadata user interface. The image below provides an example.

![](../../../.gitbook/assets/generate\_sample\_data.png)

Explicitly include sample data by adding the following key-value pair in the `source.config` field of your configuration file.

```json
"generateSampleData": "true"
```

If set to true, the connector will collect the first 50 rows of data from each table included in ingestion, and catalog that data as sample data, which users can refer to in the OpenMetadata user interface.

You can exclude the collection of sample data by adding the following key-value pair in the `source.config` field of your configuration file.

```json
"generateSampleData": "false"
```

{% hint style="info" %}
Note: `generateSampleData` is set to `true` by default.
{% endhint %}

### 3.7. Configure DBT (optional)

DBT provides transformation logic that creates tables and views from raw data. OpenMetadata includes an integration for DBT that enables you to see the models used to generate a table from that table's details page in the OpenMetadata user interface. The image below provides an example.

![](../../../.gitbook/assets/configure\_dbt.png)

To include DBT models and metadata in your ingestion workflows, specify the location of the DBT manifest and catalog files as fields in your configuration file.

#### dbtManifestFileName (optional)

Use the field `source.config.dbtManifestFileName` to specify the location of your DBT manifest file. See below for an example.

```json
"dbtManifestFileName": "./dbt/manifest.json"
```

#### dbtCatalogFileName (optional)

Use the field `source.config.dbtCatalogFileName` to specify the location of your DBT catalog file. See below for an example.

```json
"dbtCatalogFileName": "./dbt/catalog.json"
```

### 3.8. Confirm `sink` settings

You need not make any changes to the fields defined for `sink` in the template code you copied into `snowflake.json` in Step 1. This part of your configuration file should be as follows.

```json
"sink": {
    "type": "metadata-rest",
    "config": {}
  },
```

### 3.9. Confirm `workflowConfig` settings

You need not make any changes to the fields defined for `workflowConfig` in the template code you copied into `snowflake.json` in Step 1. This part of your configuration file should be as follows.

```json
"workflowConfig": {
    "openMetadataServerConfig": {
      "hostPort": "http://localhost:8585/api",
      "authProvider": "no-auth"
    }
  }
```

## 4. Run Snowflake Connector <a href="#run-manually" id="run-manually"></a>

Your `snowflake.json` configuration file should now be fully configured and ready to use in an ingestion workflow.

To run an ingestion workflow, execute the following command from the `openmetadata` directory.

```bash
metadata ingest -c ./snowflake.json
```

### Next Steps

As the ingestion workflow runs, you may observe progress both from the command line and from the OpenMetadata user interface. To view the metadata ingested from Snowflake, visit [http://localhost:8585/explore/tables](http://localhost:8585/explore/tables). Select the Snowflake service to filter for the data you've ingested using the workflow you configured and ran following this guide. The image below provides an example.

![](<../../../.gitbook/assets/next\_steps (1).png>)

## 5. Troubleshooting

### ERROR: Failed building wheel for cryptography

When attempting to install the `openmetadata-ingestion[snowflake]` Python package, you might encounter the following error. The error might include a mention of a Rust compiler.

```
Failed to build cryptography
ERROR: Could not build wheels for cryptography which use PEP 517 and cannot be installed directly
```

This error usually occurs due to an older version of pip. Try upgrading pip as follows.

```bash
pip3 install --upgrade pip setuptools
```

Then re-run the install command in Step 2.

### requests.exceptions.ConnectionError

If you encounter the following error when attempting to run the ingestion workflow in Step 10, this is probably because there is no OpenMetadata server running at http://localhost:8585.

```
requests.exceptions.ConnectionError: HTTPConnectionPool(host='localhost', port=8585): 
Max retries exceeded with url: /api/v1/services/databaseServices/name/snowflake 
(Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x1031fa310>: 
Failed to establish a new connection: [Errno 61] Connection refused'))
```

To correct this problem, please follow the steps in the [Run OpenMetadata](https://docs.open-metadata.org/v/main/try-openmetadata/run-openmetadata) guide to deploy OpenMetadata in Docker on your local machine.

Then re-run the metadata ingestion workflow in Step 10.

{% content-ref url="snowflake-usage.md" %}
[snowflake-usage.md](snowflake-usage.md)
{% endcontent-ref %}
