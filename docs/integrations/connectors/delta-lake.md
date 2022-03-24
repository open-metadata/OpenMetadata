---
description: >-
  This guide will help you install and configure the Delta Lake connector and
  run metadata ingestion workflows manually.
---

# Delta Lake

## Requirements

Using the OpenMetadata Delta Lake connector requires supporting services and software. Please ensure your host system meets the requirements listed below. Then continue to follow the procedure for installing and configuring this connector.

### OpenMetadata (version 0.8.0 or later)

You must have a running deployment of OpenMetadata to use this guide. OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Airflow for metadata ingestion workflows

If you have not already deployed OpenMetadata, please follow the instructions to [Run OpenMetadata](../../overview/run-openmetadata/) to get up and running.

### Python (version 3.8.0 or later)

Please use the following command to check the version of Python you have.

```
python3 --version
```

## Procedure

Here’s an overview of the steps in this procedure. Please follow the steps relevant to your use case.

1. [Prepare a Python virtual environment](delta-lake.md#1.-prepare-a-python-virtual-environment)
2. [Install the Python module for this connector](delta-lake.md#install-from-pypi-or-source)
3. [Create a configuration file using template JSON](delta-lake.md#3.-create-a-configuration-file-using-template-json)
4. [Configure service settings](delta-lake.md#4.-configure-service-settings)
5. [Configure data filters (optional)](delta-lake.md#5.-.-configure-data-filters-optional)
6. [Confirm sink settings](delta-lake.md#6.-confirm-sink-settings)
7. [Confirm metadata\_server settings](delta-lake.md#9.-confirm-metadata\_server-settings)
8. [Run ingestion workflow](delta-lake.md#run-manually)

### 1. Prepare a Python virtual environment

In this step, we'll create a Python virtual environment. Using a virtual environment enables us to avoid conflicts with other Python installations and packages on your host system.

In a later step, you will install the Python module for this connector and its dependencies in this virtual environment.

#### 1.1 Create a directory for openmetadata

Throughout the docs, we use a consistent directory structure for OpenMetadata services and connector installation. If you have not already done so by following another guide, please create an openmetadata directory now and change into that directory in your command line environment.

```
mkdir openmetadata; cd openmetadata
```

#### 1.2 Create a virtual environment

Run the following command to create a Python virtual environment called, `env`. You can try multiple connectors in the same virtual environment.

```bash
python3 -m venv env
```

#### 1.3 Activate the virtual environment

Run the following command to activate the virtual environment.

```bash
source env/bin/activate
```

Once activated, you should see your command prompt change to indicate that your commands will now be executed in the environment named `env`.

#### 1.4 Upgrade pip and setuptools to the latest versions

Ensure that you have the latest version of pip by running the following command. If you have followed the steps above, this will upgrade pip in your virtual environment.

```
pip3 install --upgrade pip setuptools
```

### 2. Install the Python module for this connector <a href="#install-from-pypi-or-source" id="install-from-pypi-or-source"></a>

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for the Delta Lake connector.

```bash
pip3 install 'openmetadata-ingestion[deltalake]'
```

### 3. Create a configuration file using template JSON

Create a new file called `deltalake.json` in the current directory. Note that the current directory should be the `openmetadata` directory you created in Step 1.

Copy and paste the configuration template below into the `deltalake.json` file you created.

{% hint style="info" %}
Note: The `source.config` field in the configuration JSON will include the majority of the settings for your connector. In the steps below we describe how to customize the key-value pairs in the `source.config` field to meet your needs.
{% endhint %}

{% code title="deltalake.json" %}
```javascript
{
  "source": {
    "type": "deltalake",
    "config": {
      "platform_name": "deltalake",
      "service_name": "local_deltalake"
      "database": "delta",
      "table_filter_pattern": {
        "excludes": ["[\\w]*event_vw.*"]
      },
      "schema_filter_pattern": {
        "excludes": ["deltalake.*", "information_schema.*", "performance_schema.*", "sys.*"]
      },
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

### 4. Configure service settings

In this step we will configure the Delta Lake service settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Delta Lake service as desired.

#### service\_name (mandatory)

OpenMetadata uniquely identifies services by their `service_name`. Edit the value for `source.config.service_name` with a name that distinguishes this deployment from other services, including other Delta Lake services that you might be ingesting metadata from.

```json
"service_name": "local_deltalake"
```

#### platform\_name (optional)

Edit the value for `source.config.platform_name` in `deltalake.json` for your Delta Lake deployment.&#x20;

```javascript
"platform_name": "deltalake",
```

#### database (optional)

If you want to limit metadata ingestion to a single database, include the `source.config.database` field in your configuration file. If this field is not included, the connector will ingest metadata from all databases that the specified user is authorized to read.

To specify a single database to ingest metadata from, provide the name of the database as the value for the `source.config.database` key as illustrated in the example below.

```json
"database": "delta"
```

### 5.  Configure data filters (optional)

#### table\_filter\_pattern (optional)

Use `source.config.table_filter_pattern` to select tables for metadata ingestion by name.

Use `source.config.table_filter_pattern.excludes` to exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included. See below for an example. This example is also included in the configuration template provided.

```json
"table_filter_pattern": {
    "excludes": ["information_schema.*", "[\\w]*event_vw.*"]
}
```

Use `source.config.table_filter_pattern.includes` to include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded. See below for an example.

```json
"table_filter_pattern": {
    "includes": ["corp.*", "dept.*"]
}
```

See the documentation for the [Python re module](https://docs.python.org/3/library/re.html) for information on how to construct regular expressions.

{% hint style="info" %}
You may use either `excludes` or `includes` but not both in `table_filter_pattern.`
{% endhint %}

#### schema\_filter\_pattern (optional)

Use `source.config.schema_filter_pattern.excludes` and `source.config.schema_filter_pattern.includes` field to select the schemas for metadata ingestion by name. The configuration template provides an example.

The syntax and semantics for `schema_filter_pattern` are the same as for [`table_filter_pattern`](delta-lake.md#table\_filter\_pattern-optional). Please check that section for details.

### 6. Confirm sink settings

You need not make any changes to the fields defined for `sink` in the template code you copied into `deltalake.json` in Step 4. This part of your configuration file should be as follows.

```json
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```

### 7. Confirm metadata\_server settings

You need not make any changes to the fields defined for `metadata_server` in the template code you copied into `deltalake.json` in Step 4. This part of your configuration file should be as follows.

```json
"metadata_server": {
    "type": "metadata-server",
    "config": {
        "api_endpoint": "http://localhost:8585/api",
        "auth_provider_type": "no-auth"
    }
}
```

### 8. Run ingestion workflow <a href="#run-manually" id="run-manually"></a>

Your `deltalake.json` configuration file should now be fully configured and ready to use in an ingestion workflow.

To run an ingestion workflow, execute the following command from the `openmetadata` directory you created in Step 1.

```bash
metadata ingest -c ./deltalake.json
```

## Next Steps

As the ingestion workflow runs, you may observe progress both from the command line and from the OpenMetadata user interface. To view the metadata ingested from Delta Lake, visit [http://localhost:8585/explore/tables](http://localhost:8585/explore/tables). Select the Delta Lake service to filter for the data you've ingested using the workflow you configured and ran following this guide. The image below provides an example.

![](<../../.gitbook/assets/next\_steps (1).png>)

## Troubleshooting

### ERROR: Failed building wheel for cryptography

When attempting to install the `openmetadata-ingestion[deltalake]` Python package in Step 2, you might encounter the following error. The error might include a mention of a Rust compiler.

```
Failed to build cryptography
ERROR: Could not build wheels for cryptography which use PEP 517 and cannot be installed directly
```

This error usually occurs due to an older version of pip. Try upgrading pip as follows.

```bash
pip3 install --upgrade pip setuptools
```

Then re-run the install command in [Step 2](delta-lake.md#install-from-pypi-or-source).

### requests.exceptions.ConnectionError

If you encounter the following error when attempting to run the ingestion workflow in Step 12, this is probably because there is no OpenMetadata server running at http://localhost:8585.

```
requests.exceptions.ConnectionError: HTTPConnectionPool(host='localhost', port=8585): 
Max retries exceeded with url: /api/v1/services/databaseServices/name/local_deltalake 
(Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x1031fa310>: 
Failed to establish a new connection: [Errno 61] Connection refused'))
```

To correct this problem, please follow the steps in the [Run OpenMetadata](../../overview/run-openmetadata/) guide to deploy OpenMetadata in Docker on your local machine.

Then re-run the metadata ingestion workflow in [Step 12](delta-lake.md#run-manually).
