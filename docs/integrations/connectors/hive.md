---
description: >-
  This guide will help you install and configure the Hive connector and run
  metadata ingestion workflows manually.
---

# Hive

## **Requirements**

Using the OpenMetadata Hive connector requires supporting services and software. Please ensure that your host system meets the requirements listed below. Then continue to follow the procedure for installing and configuring this connector.

### **OpenMetadata (version 0.8.0 or later)**

You must have a running deployment of OpenMetadata to use this guide. OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Airflow for metadata ingestion workflows

If you have not already deployed OpenMetadata, please follow the instructions to [Run OpenMetadata](https://docs.open-metadata.org/install/run-openmetadata) to get up and running.

### **Python (version 3.8.0 or later)**

Please use the following command to check the version of Python you have.

```
python3 --version
```

### Library: libsas**l2-dev**

Hive connector uses `pyhive` to connect and fetch metadata. Pyhive has python SASL dependency and which requires libsasl2-dev to be installed. In some cases, you may need to set LD\_LIBRARY\_PATH to point to where libsasl2-dev is installed. Please check on how to install libsasl2 for your Linux Distro.

## **Procedure**

Here’s an overview of the steps in this procedure. Please follow the steps relevant to your use case.

1. [Prepare a Python virtual environment](hive.md#1.-prepare-a-python-virtual-environment)
2. [Install the Python module for this connector](hive.md#2.-install-the-python-module-for-this-connector)
3. [Create a configuration file using template JSON](hive.md#3.-create-a-configuration-file-using-template-json)
4. [Configure service settings](hive.md#4.-configure-service-settings)
5. [Configure Kerberos authentication (optional)](hive.md#undefined)
6. [Enable/disable the data profiler](hive.md#5.-enable-disable-the-data-profiler)
7. [Install the data profiler Python module (optional)](hive.md#6.-install-the-data-profiler-python-module-optional)
8. [Configure data filters (optional)](hive.md#7.-configure-data-filters-optional)
9. [Configure sample data (optional)](hive.md#8.-configure-sample-data-optional)
10. [Configure DBT (optional)](hive.md#9.-configure-dbt-optional)
11. [Confirm sink settings](hive.md#10.-confirm-sink-settings)
12. [Confirm metadata\_server settings](hive.md#11.-confirm-metadata\_server-settings)
13. [Run ingestion workflow](hive.md#12.-run-ingestion-workflow)

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

### **2. Install the Python module for this connector**

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for the Hive connector.

```javascript
#install hive-sasl library
sudo apt-get install libsasl2-dev
pip3 install 'openmetadata-ingestion[hive]'
```

### **3. Create a configuration file using template JSON**

Create a new file called `hive.json` in the current directory. Note that the current directory should be the `openmetadata` directory you created in Step 1.

Copy and paste the configuration template below into the `hive.json` file you created.

{% hint style="info" %}
Note: The `source.config` field in the configuration JSON will include the majority of the settings for your connector. In the steps below we describe how to customize the key-value pairs in the `source.config` field to meet your needs.
{% endhint %}

{% code title="hive.json" %}
```javascript
{
  "source": {
    "type": "hive",
    "config": {
      "database": "hive_db",
      "service_name": "local_hive",
      "host_port": "hostname.domain.com:10000",
      "connect_args": {
        "auth": "KERBEROS",
        "kerberos_service_name": "hive"
      },
      "scheme": "hive",
      "query": "select top 50 * from {}.{}",
      "data_profiler_enabled": "true",
      "data_profiler_offset": "0",
      "data_profiler_limit": "50000"
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

### **4. Configure service settings**

In this step we will configure the Hive service settings required for this connector. Please follow the instructions below to ensure that you’ve configured the connector to read from your Hive service as desired.

#### **host\_port**

Edit the value for `source.config.host_port` in `hive.json` for your Hive deployment. Use the `host:port` format illustrated in the example below.

```javascript
"host_port": "hostname.domain.com:10000"
```

Please ensure that your Hive deployment is reachable from the host you are using to run metadata ingestion.

#### **username (optional)**

Edit the value for `source.config.username` to identify your Hive user.

```javascript
"username": "username"
```

{% hint style="danger" %}
**Note:** The user specified should be authorized to read all databases you want to include in the metadata ingestion workflow.
{% endhint %}

#### **password (optional)**

Edit the value for `source.config.password` with the password for your Hive user.

```javascript
"password": "strong_password"
```

#### **service\_name**

OpenMetadata uniquely identifies services by their `service_name`. Edit the value for `source.config.service_name` with a name that distinguishes this deployment from other services, including other Hive services that you might be ingesting metadata from.

```javascript
"service_name": "local_hive"
```

#### **database (optional)**

If you want to limit metadata ingestion to a single database, include the `source.config.database` field in your configuration file. If this field is not included, the connector will ingest metadata from all databases that the specified user is authorized to read.

To specify a single database to ingest metadata from, provide the name of the database as the value for the `source.config.database` key as illustrated in the example below.

```javascript
"database": "hive_db"
```

### 5. Configure Kerberos authentication (optional)

If you need to use Kerberos authentication, include the `source.config.connect_args` field as follows. This field is included in the configuration template JSON provided above.

```json
"connect_args": {
  "auth": "KERBEROS",
  "kerberos_service_name": "hive"
} 
```

These settings will instruct the connector to use Kerberos to authenticate for this Hive service.&#x20;

{% hint style="info" %}
Note: Using Kerberos authentication requires that a Kerberos ticket has been issued using the `kinit` command.&#x20;
{% endhint %}

{% hint style="danger" %}
Warning: If you do not intend to use Kerberos authentication, please remove the `source.config.connect_args` field from your configuration JSON.
{% endhint %}

### **6. Enable/disable the data profiler**

The data profiler ingests usage information for tables. This enables you to assess the frequency of use, reliability, and other details.

#### **data\_profiler\_enabled**

When enabled, the data profiler will run as part of metadata ingestion. Running the data profiler increases the amount of time it takes for metadata ingestion, but provides the benefits mentioned above.

You may disable the data profiler by setting the value for the key `source.config.data_profiler_enabled` to `"false"` as follows. We’ve done this in the configuration template provided.

```javascript
"data_profiler_enabled": "false"
```

If you want to enable the data profiler, update your configuration file as follows.

```javascript
"data_profiler_enabled": "true"
```

{% hint style="info" %}
**Note:** The data profiler is enabled by default if no setting is provided for `data_profiler_enabled`
{% endhint %}

### **7. Install the data profiler Python module (optional)**

If you enabled the data profiler above, run the following command to install the Python module for the data profiler. You’ll need this to run the ingestion workflow.

```javascript
pip3 install 'openmetadata-ingestion[data-profiler]'
```

The data profiler module takes a few minutes to install. While it installs, continue through the remaining steps in this guide.

### **8. Configure data filters (optional)**

#### **include\_views (optional)**

Use `source.config.include_views` to control whether or not to include views as part of metadata ingestion and data profiling.

Explicitly include views by adding the following key-value pair in the `source.config` field of your configuration file.

```javascript
"include_views": "true"
```

Exclude views as follows.

```javascript
"include_views": "false"
```

{% hint style="info" %}
**Note:** `source.config.include_views` is set to true by default.
{% endhint %}

#### **include\_tables (optional)**

Use `source.config.include_tables` to control whether or not to include tables as part of metadata ingestion and data profiling.

Explicitly include tables by adding the following key-value pair in the `source.config` field of your configuration file.

```javascript
"include_tables": "true"
```

Exclude tables as follows.

```javascript
"include_tables": "false"
```

{% hint style="info" %}
**Note:** `source.config.include_tables` is set to true by default.
{% endhint %}

#### **table\_filter\_pattern (optional)**

Use `source.config.table_filter_pattern` to select tables for metadata ingestion by name.

Use `source.config.table_filter_pattern.excludes` to exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included. See below for an example. This example is also included in the configuration template provided.

```javascript
"table_filter_pattern": {
"excludes": ["information_schema.*", "[\\w]*event_vw.*"]
}
```

Use `source.config.table_filter_pattern.includes` to include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded. See below for an example.

```javascript
"table_filter_pattern": {
"includes": ["corp.*", "dept.*"]
}
```

See the documentation for the[ Python re module](https://docs.python.org/3/library/re.html) for information on how to construct regular expressions.

{% hint style="info" %}
You may use either `excludes` or `includes` but not both in `table_filter_pattern`.
{% endhint %}

#### **schema\_filter\_pattern (optional)**

Use `source.config.schema_filter_pattern.excludes` and `source.config.schema_filter_pattern.includes` field to select the schemas for metadata ingestion by name. The configuration template provides an example.

The syntax and semantics for `schema_filter_pattern` are the same as for [`table_filter_pattern`](hive.md#table\_filter\_pattern-optional). Please check that section for details.

### **9. Configure sample data (optional)**

#### **generate\_sample\_data (optional)**

Use the `source.config.generate_sample_data` field to control whether or not to generate sample data to include in table views in the OpenMetadata user interface. The image below provides an example.

![](../../.gitbook/assets/generate\_sample\_data.png)

Explicitly include sample data by adding the following key-value pair in the `source.config` field of your configuration file.

```javascript
"generate_sample_data": "true"
```

If set to true, the connector will collect the first 50 rows of data from each table included in ingestion, and catalog that data as sample data, which users can refer to in the OpenMetadata user interface.

You can exclude the collection of sample data by adding the following key-value pair in the `source.config` field of your configuration file.

```javascript
"generate_sample_data": "false"
```

{% hint style="info" %}
**Note:** `generate_sample_data` is set to true by default.
{% endhint %}

### **10. Configure DBT (optional)**

DBT provides transformation logic that creates tables and views from raw data. OpenMetadata’s integration for DBT enables you to view the models used to generate a table from that table's details page in the OpenMetadata UI. The image below provides an example.

![](../../.gitbook/assets/configure\_dbt.png)

To include DBT models and metadata in your ingestion workflows, specify the location of the DBT manifest and catalog files as fields in your configuration file.

#### **dbt\_manifest\_file (optional)**

Use the field `source.config.dbt_manifest_file` to specify the location of your DBT manifest file. See below for an example.

```javascript
"dbt_manifest_file": "./dbt/manifest.json"
```

#### **dbt\_catalog\_file (optional)**

Use the field `source.config.dbt_catalog_file` to specify the location of your DBT catalog file. See below for an example.

```javascript
"dbt_catalog_file": "./dbt/catalog.json"
```

### **11. Confirm sink settings**

You need not make any changes to the fields defined for `sink` in the template code you copied into `hive.json` above. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```

### **12. Confirm metadata\_server settings**

You need not make any changes to the fields defined for `metadata_server` in the template code you copied into `hive.json` above. This part of your configuration file should be as follows.

```javascript
"metadata_server": {
    "type": "metadata-server",
    "config": {
        "api_endpoint": "http://localhost:8585/api",
        "auth_provider_type": "no-auth"
    }
}
```

### **13. Run ingestion workflow**

Your `hive.json` configuration file should now be fully configured and ready to use in an ingestion workflow.

To run an ingestion workflow, execute the following command from the `openmetadata` directory you created in Step 1.

```
metadata ingest -c ./hive.json
```

## **Next Steps**

As the ingestion workflow runs, you may observe progress both from the command line and from the OpenMetadata user interface. To view the metadata ingested from Hive, visit [http://localhost:8585/explore/tables](http://localhost:8585/explore/tables). Select the Hive service to filter for the data you’ve ingested using the workflow you configured and ran following this guide. The image below provides an example.

![](<../../.gitbook/assets/next\_steps (1).png>)

## **Troubleshooting**

### **ERROR: Failed building wheel for cryptography**

When attempting to install the `openmetadata-ingestion[hive]` Python package in Step 2, you might encounter the following error. The error might include a mention of a Rust compiler.

```
Failed to build cryptography
ERROR: Could not build wheels for cryptography which use PEP 517 and cannot be installed directly
```

This error usually occurs due to an older version of pip. Try upgrading pip as follows.

```
pip3 install --upgrade pip setuptools
```

Then re-run the install command in [Step 2](hive.md#2.-install-the-python-module-for-this-connector).

### **requests.exceptions.ConnectionError**

If you encounter the following error when attempting to run the ingestion workflow in Step 13, this is probably because there is no OpenMetadata server running at http://localhost:8585.

```
requests.exceptions.ConnectionError: HTTPConnectionPool(host='localhost', port=8585): 
Max retries exceeded with url: /api/v1/services/databaseServices/name/local_hive 
(Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x1031fa310>: 
Failed to establish a new connection: [Errno 61] Connection refused'))
```

To correct this problem, please follow the steps in the [Run OpenMetadata ](https://docs.open-metadata.org/install/run-openmetadata)guide to deploy OpenMetadata in Docker on your local machine.

Then re-run the metadata ingestion workflow in [Step 13](hive.md#12.-run-ingestion-workflow).

### thrift.transport.TTransport.TTransportException

If you encounter the following error when attempting to run an ingestion workflow and are using Kerberos authentication, you are probably missing some required libraries.

```
thrift.transport.TTransport.TTransportException: Could not start SASL:
b'Error in sasl_client_start (-4) SASL(-4): no mechanism available:
No worthy mechs found'
```

To correct this problem, install all dependencies required to connect to a HIVE cluster via Kerberos. This [Stackoverflow issue](https://stackoverflow.com/questions/30705576/python-cannot-connect-hiveserver2\)-) might be of help.

&#x20;For Ubuntu, you may install the required dependencies by running the following command.

```
sudo apt-get install sasl2-bin libsasl2-2 libsasl2-dev libsasl2-modules libsasl2-modules-gssapi-mit
```
