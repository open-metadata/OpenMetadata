---
description: >-
  This guide will help you install and configure the Glue connector and run
  metadata ingestion workflows manually.
---

# Glue Catalog

## **Requirements**

Using the OpenMetadata Glue connector requires supporting services and software. Please ensure that your host system meets the requirements listed below. Then continue to follow the procedure for installing and configuring this connector.

### **OpenMetadata (version 0.7.0 or later)**

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

## **Procedure**

Here’s an overview of the steps in this procedure. Please follow the steps relevant to your use case.

1. [Prepare a Python virtual environment](glue-catalog.md#1.-prepare-a-python-virtual-environment)
2. [Install the Python module for this connector](glue-catalog.md#2.-install-the-python-module-for-this-connector)&#x20;
3. [Configure a local AWS profile](glue-catalog.md#3.-configure-a-local-aws-profile)
4. [Create a configuration file using template JSON](glue-catalog.md#3.-create-a-configuration-file-using-template-json)&#x20;
5. [Configure service settings](glue-catalog.md#4.-configure-service-settings)&#x20;
6. [Enable/disable the data profiler](glue-catalog.md#5.-enable-disable-the-data-profiler)&#x20;
7. [Install the data profiler Python module (optional)](glue-catalog.md#6.-install-the-data-profiler-python-module-optional)&#x20;
8. [Configure data filters (optional)](glue-catalog.md#7.-configure-data-filters-optional)&#x20;
9. [Configure sample data (optional)](glue-catalog.md#8.-configure-sample-data-optional)&#x20;
10. [Configure DBT (optional)](glue-catalog.md#9.-configure-dbt-optional)&#x20;
11. [Confirm sink settings](glue-catalog.md#10.-confirm-sink-settings)&#x20;
12. [Confirm metadata\_server settings](glue-catalog.md#11.-confirm-metadata\_server-settings)&#x20;
13. [Run ingestion workflow](glue-catalog.md#12.-run-ingestion-workflow)

### **1. Prepare a Python virtual environment**

In this step, we’ll create a Python virtual environment. Using a virtual environment enables us to avoid conflicts with other Python installations and packages on your host system.&#x20;

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

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for the Glue connector.

```javascript
pip3 install 'openmetadata-ingestion[glue]'
```

### **3. Configure a local AWS profile**

In order to use the Glue Catalog connector, you will need AWS credentials configured and available to the connector. The best way to do this is by configuring a local AWS profile using the AWS Command-Line Interface (CLI). In this step we will install the AWS CLI and then configure an AWS profile.

{% hint style="info" %}
Note: If you do not have an existing AWS profile and opt not to create one, you will need to supply AWS credentials in your Glue catalog configuration file. We recommend that you use an AWS profile rather than including AWS credentials in your configuration file.
{% endhint %}

#### 3a. Install the AWS CLI

To install the AWS CLI, follow the installation guide for your operating system from the [AWS documentation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

#### 3b. Configure your AWS profile

With the AWS CLI installed, to configure your AWS profile run the following command.

```bash
aws configure
```

Then, enter the appropriate values at the prompts to complete your profile. Your interaction with the aws configure command should look something like the following.

```bash
$ aws configure
AWS Access Key ID [None]: <your accesskey>
AWS Secret Access Key [None]: <your secretkey>
Default region name [None]: <your region, e.g., us-west-2>
Default output format [None]:
```

Please enter your accesskey, secretkey, and region when prompted. The OpenMetadata Glue Catalog connector will use the credentials from your AWS profile to connect to the right endpoint and authenticate for metadata ingestion.

#### 3c. Test access to your Glue catalog

Run the following command to ensure your AWS credentials and region are configured properly.

```
aws glue list-schemas
```

In response you will either see a formatted list of schemas defined in your Glue catalog or receive a message indicating that no schemas are defined in your catalog.

### **4. Create a configuration file using template JSON**

Create a new file called `glue.json` in the current directory. Note that the current directory should be the `openmetadata` directory you created in Step 1.

Copy and paste the configuration template below into the `glue.json` file you created.

{% hint style="info" %}
Note: The `source.config` field in the configuration JSON will include the majority of the settings for your connector. In the steps below we describe how to customize the key-value pairs in the `source.config` field to meet your needs.
{% endhint %}

### **5. Configure service settings**

In this step we will configure the Glue service settings required for this connector. Please follow the instructions below to ensure that you’ve configured the connector to read from your Glue service as desired.

{% code title="glue.json" %}
```javascript
{
  "source": {
    "type": "glue",
    "config": {
      "aws_session_token": "session_token",
      "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
      "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      "service_name": "unique_name_to_identify_database_and_table_metadata",
      "pipeline_service_name": "unique_name_to_identify_pipeline_metadata",
      "storage_service_name": "unique_name_to_identify_storage_service_metadata",
      "region_name": "us-east-2",
      "endpoint_url": "glue.us-east-2.amazonaws.com"
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

#### aws\_session\_token (optional)

Edit the value for `source.config.aws_session_token` to specify a session token for your Glue client. This setting is optional.

See [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id\_credentials\_temp\_use-resources.html) for documentation on using AWS session tokens.

```json
"aws_session_token": "session_token"
```

#### aws\_access\_key\_id (optional)

Edit the value for `source.config.aws_access_key_id` to specify the key id for your AWS user. This setting is optional.

```json
"aws_access_key_id": "AKIAIOSFODNN7EXAMPLE"
```

{% hint style="info" %}
Note: We recommend that you use a local AWS profile containing your access key id and secret access key rather than including these values in your configuration file.&#x20;
{% endhint %}

#### aws\_secret\_access\_key (optional)

Edit the value for `source.config.aws_secret_access_key` to specify the secret for your AWS user. This setting is optional.

```json
"aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

{% hint style="info" %}
Note: We recommend that you use a local AWS profile containing your access key id and secret access key rather than including these values in your configuration file.&#x20;
{% endhint %}

#### service\_name

OpenMetadata associates each database and table entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata ingested from database services you are using through AWS Glue.&#x20;

Edit the value for `source.config.service_name` with a name that uniquely identifies this database and table metadata.

```json
"service_name": "unique_name_to_identify_database_and_table_metadata"
```

When the metadata has been ingested you will find it in the OpenMetadata UI databases view under the name you have specified.

#### pipeline\_service\_name

OpenMetadata associates each pipeline entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata for pipelines you are using through AWS Glue.&#x20;

Edit the value for `source.config.pipeline_service_name` with a name that uniquely identifies this pipeline metadata.

```json
"pipeline_service_name": "unique_name_to_identify_pipeline_metadata"
```

When this metadata has been ingested you will find it in the OpenMetadata UI pipelines view under the name you have specified.

#### storage\_service\_name (optional)

OpenMetadata associates objects for each object store entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata for the object stores you are using through AWS Glue.&#x20;

Edit the value for `source.config.storage_service_name` with a name that uniquely identifies this object store metadata.

```json
"storage_service_name": "unique_name_to_identify_storage_service_metadata"
```

#### region\_name

Specify the region in which your Glue catalog is located using `source.config.region_name`.&#x20;

```
"region_name": "region_for_your_glue_catalog"
```

{% hint style="info" %}
Note: This setting is required even if you have configured a local AWS profile and included a value for `region_name`.
{% endhint %}

#### endpoint\_url (optional)

The Glue connector will automatically determine the AWS Glue endpoint url based on the `region_name`.&#x20;

You may specify a value for `source.config.endpoint_url` to override this behavior. The value you specify should be a complete url, including the protocol (i.e. “http" or "https”).

```json
"endpoint_url": "endpoint_url"
```

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

If you’ve enabled the data profiler in Step 5, run the following command to install the Python module for the data profiler. You’ll need this to run the ingestion workflow.

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

The syntax and semantics for `schema_filter_pattern` are the same as for [`table_filter_pattern`](glue-catalog.md#table\_filter\_pattern-optional). Please check that section for details.

### **9. Configure sample data (optional)**

#### **generate\_sample\_data (optional)**

Use the `source.config.generate_sample_data` field to control whether or not to generate sample data to include in table views in the OpenMetadata user interface. The image below provides an example.

![](../.gitbook/assets/generate\_sample\_data.png)

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

![](../.gitbook/assets/configure\_dbt.png)

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

You need not make any changes to the fields defined for `sink` in the template code you copied into `glue.json` in Step 4. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```

### **12. Confirm metadata\_server settings**

You need not make any changes to the fields defined for `metadata_server` in the template code you copied into `glue.json` in Step 4. This part of your configuration file should be as follows.

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

Your `glue.json` configuration file should now be fully configured and ready to use in an ingestion workflow.

To run an ingestion workflow, execute the following command from the `openmetadata` directory you created in Step 1.

```
metadata ingest -c ./glue.json
```

## **Next Steps**

As the ingestion workflow runs, you may observe progress both from the command line and from the OpenMetadata user interface. To view the metadata ingested from Glue, visit [http://localhost:8585/explore/tables](http://localhost:8585/explore/tables). Select the Glue service to filter for the data you’ve ingested using the workflow you configured and ran following this guide. The image below provides an example.

![](<../.gitbook/assets/next\_steps (1).png>)

## **Troubleshooting**

### **ERROR: Failed building wheel for cryptography**

When attempting to install the `openmetadata-ingestion[glue]` Python package in Step 2, you might encounter the following error. The error might include a mention of a Rust compiler.

```
Failed to build cryptography
ERROR: Could not build wheels for cryptography which use PEP 517 and cannot be installed directly
```

This error usually occurs due to an older version of pip. Try upgrading pip as follows.

```
pip3 install --upgrade pip setuptools
```

Then re-run the install command in [Step 2](glue-catalog.md#2.-install-the-python-module-for-this-connector).

### **requests.exceptions.ConnectionError**

If you encounter the following error when attempting to run the ingestion workflow in Step 12, this is probably because there is no OpenMetadata server running at http://localhost:8585.

```
requests.exceptions.ConnectionError: HTTPConnectionPool(host='localhost', port=8585): 
Max retries exceeded with url: /api/v1/services/databaseServices/name/local_glue 
(Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x1031fa310>: 
Failed to establish a new connection: [Errno 61] Connection refused'))
```

To correct this problem, please follow the steps in the [Run OpenMetadata ](https://docs.open-metadata.org/install/run-openmetadata)guide to deploy OpenMetadata in Docker on your local machine.

Then re-run the metadata ingestion workflow in [Step 12](glue-catalog.md#12.-run-ingestion-workflow).
