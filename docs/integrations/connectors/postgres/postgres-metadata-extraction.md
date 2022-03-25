---
description: >-
  This guide will help you configure metadata ingestion workflows using the
  Postgres connector.
---

# Postgres Metadata Extraction

There are three options for configuring metadata ingestion for this connector. They are as follows:

1. Schedule metadata ingestion workflows via the **Airflow SDK**. Use this option if you already have an Airflow instance running that you plan to use for workflow scheduling with OpenMetadata.
2. Schedule metadata ingestion workflows via the **OpenMetadata UI**. Use this option if you prefer to manage ingestion through the UI and are prepared to either install the [OpenMetadata Airflow REST API plugin](https://pypi.org/project/openmetadata-airflow-managed-apis/) in your Airflow deployment or will use the Airflow container that ships with OpenMetadata.
3. Use the OpenMetadata ingestion Python module to perform a **One-time ingestion**. Use this option if you want to perform a trial of OpenMetadata in a test environment

Please select the approach you would prefer to use for metadata ingestion from the tabs below.

{% tabs %}
{% tab title="Airflow SDK" %}
## Schedule Ingestion via the Airflow SDK <a href="#mysql-connector-airflow-sdk" id="mysql-connector-airflow-sdk"></a>

## **Requirements**

Using the OpenMetadata Postgres connector requires supporting services and software. Please ensure that your host system meets the requirements listed below. Then continue to follow the procedure for installing and configuring this connector.



### **OpenMetadata (version 0.8.0 or later)**

You must have a running deployment of OpenMetadata to use this guide. OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Airflow for metadata ingestion workflows



### **Python (version 3.8.0 or later)**

Please use the following command to check the version of Python you have.

```
python3 --version
```



### PostgreSQL (version 14.1 or later)

Please use the following command to check the version of PostgreSQL you have.

```
postgres --version
```



## Procedure

Here’s an overview of the steps in this procedure. Please follow the steps relevant to your use case.

1. Create a configuration file using template JSON
2. Configure service settings
3. Configure data filters (optional)
4. Configure sample data (optional)
5. Configure DBT (optional)
6. Confirm sink settings
7. Confirm metadata\_server settings
8. Install the OpenMetadata Postgres Python module
9. Edit a Python script to define your ingestion DAG
10. Copy your configuration JSON into the ingestion script
11. Run the script to create your ingestion DAG



### 1**. Create a configuration file using template JSON**

Create a new file called `postgres.json` in the current directory. Note that the current directory should be the `openmetadata` directory.

Copy and paste the configuration template below into the `postgres.json` file you created.

{% hint style="info" %}
Note: The `source.config` field in the configuration JSON will include the majority of the settings for your connector. In the steps below we describe how to customize the key-value pairs in the `source.config` field to meet your needs.
{% endhint %}

{% code title="postgres.json" %}
```javascript
{
  "source": {
    "type": "postgres",
    "config": {
      "username": "username",
      "password": "strong_password",
      "host_port": "localhost:5432",
      "database": "postgres_db",
      "service_name": "local_postgres",
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



### 2**. Configure service settings**

In this step we will configure the Postgres service settings required for this connector. Please follow the instructions below to ensure that you’ve configured the connector to read from your Postgres service as desired.

#### ****

#### **host\_port**

Edit the value for `source.config.host_port` in `postgres.json` for your Postgres deployment. Use the `host:port` format illustrated in the example below.

```javascript
"host_port": "localhost:5432"
```

Please ensure that your Postgres deployment is reachable from the host you are using to run metadata ingestion.

#### ****

#### **username**

Edit the value for `source.config.username` to identify your Postgres user.

```javascript
"username": "username"
```

{% hint style="danger" %}
**Note:** The user specified should be authorized to read all databases you want to include in the metadata ingestion workflow.
{% endhint %}

#### ****

#### **password**

Edit the value for `source.config.password` with the password for your Postgres user.

```javascript
"password": "strong_password"
```

#### ****

#### **service\_name**

OpenMetadata uniquely identifies services by their `service_name`. Edit the value for `source.config.service_name` with a name that distinguishes this deployment from other services, including other Postgres services that you might be ingesting metadata from.

```javascript
"service_name": "local_postgres"
```

#### ****

#### **database (optional)**

If you want to limit metadata ingestion to a single database, include the `source.config.database` field in your configuration file. If this field is not included, the connector will ingest metadata from all databases that the specified user is authorized to read.

To specify a single database to ingest metadata from, provide the name of the database as the value for the `source.config.database` key as illustrated in the example below.

```javascript
"database": "postgres_db"
```



### **3. Configure data filters (optional)**

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

#### ****

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

#### ****

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

#### ****

#### **schema\_filter\_pattern (optional)**

Use `source.config.schema_filter_pattern.excludes` and `source.config.schema_filter_pattern.includes` field to select the schemas for metadata ingestion by name. The configuration template provides an example.

The syntax and semantics for `schema_filter_pattern` are the same as for [`table_filter_pattern`](postgres-metadata-extraction.md#table\_filter\_pattern-optional). Please check that section for details.



### **4. Configure sample data (optional)**

#### **generate\_sample\_data (optional)**

Use the `source.config.generate_sample_data` field to control whether or not to generate sample data to include in table views in the OpenMetadata user interface. The image below provides an example.

![](../../../.gitbook/assets/generate\_sample\_data.png)

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



### 5. Configure DBT (optional)

DBT provides transformation logic that creates tables and views from raw data. OpenMetadata includes an integration for DBT that enables you to see the models used to generate a table from that table's details page in the OpenMetadata user interface. The image below provides an example.

![](../../../.gitbook/assets/configure\_dbt.png)

To include DBT models and metadata in your ingestion workflows, specify the location of the DBT manifest and catalog files as fields in your configuration file.



#### dbt\_manifest\_file (optional)

Use the field `source.config.dbt_manifest_file` to specify the location of your DBT manifest file. See below for an example.

```json
"dbt_manifest_file": "./dbt/manifest.json"
```



#### dbt\_catalog\_file (optional)

Use the field `source.config.dbt_catalog_file` to specify the location of your DBT catalog file. See below for an example.

```json
"dbt_catalog_file": "./dbt/catalog.json"
```



### **6. Confirm `sink` settings**

You need not make any changes to the fields defined for `sink` in the template code you copied into `postgres.json` in Step 1. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```



### **7. Confirm `metadata_server` settings**

You need not make any changes to the fields defined for `metadata_server` in the template code you copied into `postgres.json` in Step 1. This part of your configuration file should be as follows.

```javascript
"metadata_server": {
    "type": "metadata-server",
    "config": {
        "api_endpoint": "http://localhost:8585/api",
        "auth_provider_type": "no-auth"
    }
}
```



### 8. Install the OpenMetadata Postgres Python module

Install the OpenMetadata Postgres Python module by running the following command.

```bash
pip3 install --upgrade 'openmetadata-ingestion[postgres]'
```



### 9. Edit a Python script to define your ingestion DAG

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



### 10. Copy your configuration JSON into the ingestion script

In steps 1 - 8 above you created a JSON file with the configuration for your ingestion connector. Copy that JSON into the `openmetadata-airflow.py` file that you created in step 9 as directed by the comment below.

```
config = """
  ## REPLACE THIS LINE WITH YOUR CONFIGURATION JSON
"""
```



### 11. Run the script to create your ingestion DAG

Run the following command to create your ingestion DAG in Airflow.

```
python openmetadata-airflow.py
```
{% endtab %}

{% tab title="OpenMetadata UI" %}
## Schedule Ingestion via the OpenMetadata UI

The OpenMetadata UI provides an integrated workflow for adding a new data service and configuring ingestion workflows.

## **Requirements**

Using the OpenMetadata Postgres connector requires supporting services and software. Please ensure that your host system meets the requirements listed below. Then continue to follow the procedure for setting up a Postgres service and ingestion workflow using the OpenMetadata UI.



### **OpenMetadata (version 0.8.0 or later)**

You must have a running deployment of OpenMetadata to use this guide. By default, OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Apache Airflow for metadata ingestion workflows



### Apache Airflow (version 2.2 or later)

By default, OpenMetadata ships with Apache Airflow and is configured to use the distributed Airflow container. However, you may also use your own Airflow instance. To use your own Airflow instance, you will need to install the [OpenMetadata Airflow REST API plugin](https://pypi.org/project/openmetadata-airflow-managed-apis/).



### PostgreSQL (version 14.1 or later)

Please use the following command to check the version of PostgreSQL you have.

```
postgres --version
```

## Procedure (in Beta)



### 1. Visit the _Services_ page

You may configure scheduled ingestion workflows from the _Services_ page in the OpenMetadata UI. To visit the _Services_ page, select _Services_ from the _Settings_ menu.

![](<../../../.gitbook/assets/image (16) (1) (1).png>)

### 2. Initiate a new service creation

From the Database Service UI, click the _Add New Service_ button to add your Postgres service to OpenMetadata for metadata ingestion.

![](<../../../.gitbook/assets/image (30).png>)

### 3. Select service type

Select Postgres as the service type.

![](<../../../.gitbook/assets/image (8).png>)



### 4. Name and describe your service

Provide a name and description for your service as illustrated below.

#### Name

OpenMetadata uniquely identifies services by their _Name_. Provide a name that distinguishes your deployment from other services, including other Postgres services that you might be ingesting metadata from.

#### Description

Provide a description for your Postgres service that enables other users to determine whether it might provide data of interest to them.

![](<../../../.gitbook/assets/image (6).png>)



### 5. Configure service connection

In this step, we will configure the connection settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Postgres service as desired.

![](<../../../.gitbook/assets/image (38).png>)

#### Host

Enter fully qualified hostname for your Postgres deployment in the _Host_ field.

#### Port

Enter the port number on which your Postgres deployment listens for client connections in the _Port_ field.

#### Username

Enter username of your Postgres user in the _Username_ field. The user specified should be authorized to read all databases you want to include in the metadata ingestion workflow.

#### Password

Enter the password for your Postgres user in the _Password_ field.&#x20;

#### Database (optional)

If you want to limit metadata ingestion to a single database, enter the name of this database in the Database field. If no value is entered for this field, the connector will ingest metadata from all databases that the specified user is authorized to read.



### 6. Configure metadata ingestion

In this step we will configure the metadata ingestion settings for your Postgres deployment. Please follow the instructions below to ensure that you've configured the connector to read from your Postgres service as desired.

![](<../../../.gitbook/assets/image (36).png>)

#### Ingestion name

OpenMetadata will pre-populate the _Ingestion name_ field. You may modify the _Ingestion name,_ but if you do, please ensure it is unique for this service.

#### Include (Table Filter Pattern)

Use to table filter patterns to control whether or not to include tables as part of metadata ingestion and data profiling.

Explicitly include tables by adding a list of comma-separated regular expressions to the _Include_ field. OpenMetadata will include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded. See the figure above for an example.

#### Exclude (Table Filter Pattern)

Explicitly exclude tables by adding a list of comma-separated regular expressions to the _Exclude_ field. OpenMetadata will exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included. See the figure above for an example.&#x20;

#### Include (Schema Filter Pattern)

Use to schema filter patterns to control whether or not to include schemas as part of metadata ingestion and data profiling.

Explicitly include schemas by adding a list of comma-separated regular expressions to the _Include_ field. OpenMetadata will include all schemas with names matching one or more of the supplied regular expressions. All other schemas will be excluded.

#### Exclude (Schema Filter Pattern)

Explicitly exclude schemas by adding a list of comma-separated regular expressions to the _Exclude_ field. OpenMetadata will exclude all schemas with names matching one or more of the supplied regular expressions. All other schemas will be included.

**Include views (toggle)**

Set the _Include views_ toggle to the on position to control whether or not to include views as part of metadata ingestion and data profiling.

Explicitly include views by adding the following key-value pair in the `source.config` field of your configuration file.

**Enable data profiler (toggle)**

The data profiler ingests usage information for tables. This enables you to assess the frequency of use, reliability, and other details.

When enabled, the data profiler will run as part of metadata ingestion. Running the data profiler increases the amount of time it takes for metadata ingestion, but provides the benefits mentioned above.

Set the _Enable data profiler_ toggle to the on position to enable the data profiler.

**Ingest sample data (toggle)**

Set the _Ingest sample data_ toggle to the on position to control whether or not to generate sample data to include in table views in the OpenMetadata user interface.

**Every**

Use the _Every_ drop down menu to select the interval at which you want to ingest metadata. Your options are as follows:

* _Hour_: Ingest metadata once per hour
* _Day_: Ingest metadata once per day
* _Week_: Ingest metadata once per week

**Day**

The _Day_ selector is only active when ingesting metadata once per week. Use the _Day_ selector to set the day of the week on which to ingest metadata.

**Minute**

The _Minute_ dropdown is only active when ingesting metadata once per hour. Use the _Minute_ drop down menu to select the minute of the hour at which to begin ingesting metadata.

**Time**

The _Time_ drop down menus are active when ingesting metadata either once per day or once per week. Use the time drop downs to select the time of day at which to begin ingesting metadata.

**Start date (UTC)**

Use the _Start date_ selector to choose the date at which to begin ingesting metadata according to the defined schedule.

**End date (UTC)**

Use the _End date_ selector to choose the date at which to stop ingesting metadata according to the defined schedule. If no end date is set, metadata ingestion will continue according to the defined schedule indefinitely.



### 7. Review configuration and save

Review your configuration settings. If they match what you intended, click Save to create the service and schedule metadata ingestion.

If something doesn't look right, click the _Previous_ button to return to the appropriate step and change the settings as needed.

![](<../../../.gitbook/assets/image (63).png>)
{% endtab %}

{% tab title="One-time Ingestion" %}
## One-time Ingestion

## **Requirements**

Using the OpenMetadata Postgres connector requires supporting services and software. Please ensure that your host system meets the requirements listed below. Then continue to follow the procedure for installing and configuring this connector.



### **OpenMetadata (version 0.8.0 or later)**

You must have a running deployment of OpenMetadata to use this guide. OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Airflow for metadata ingestion workflows



### **Python (version 3.8.0 or later)**

Please use the following command to check the version of Python you have.

```
python3 --version
```



### PostgreSQL (version 14.1 or later)

Please use the following command to check the version of PostgreSQL you have.

```
postgres --version
```



## Procedure

Here’s an overview of the steps in this procedure. Please follow the steps relevant to your use case.

1. Create a configuration file using template JSON
2. Configure service settings
3. Configure data filters (optional)
4. Configure sample data (optional)
5. Configure DBT (optional)
6. Confirm sink settings
7. Confirm metadata\_server settings
8. Install the Python module for this connector
9. Run ingestion workflow



### 1**. Create a configuration file using template JSON**

Create a new file called `postgres.json`. Copy and paste the configuration template below into the `postgres.json` file you created.

{% hint style="info" %}
Note: The `source.config` field in the configuration JSON will include the majority of the settings for your connector. In the steps below we describe how to customize the key-value pairs in the `source.config` field to meet your needs.
{% endhint %}

{% code title="postgres.json" %}
```javascript
{
  "source": {
    "type": "postgres",
    "config": {
      "username": "username",
      "password": "strong_password",
      "host_port": "localhost:5432",
      "database": "postgres_db",
      "service_name": "local_postgres",
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



### 2**. Configure service settings**

In this step we will configure the Postgres service settings required for this connector. Please follow the instructions below to ensure that you’ve configured the connector to read from your Postgres service as desired.

#### ****

#### **host\_port**

Edit the value for `source.config.host_port` in `postgres.json` for your Postgres deployment. Use the `host:port` format illustrated in the example below.

```javascript
"host_port": "localhost:5432"
```

Please ensure that your Postgres deployment is reachable from the host you are using to run metadata ingestion.

#### ****

#### **username**

Edit the value for `source.config.username` to identify your Postgres user.

```javascript
"username": "username"
```

{% hint style="danger" %}
**Note:** The user specified should be authorized to read all databases you want to include in the metadata ingestion workflow.
{% endhint %}

#### ****

#### **password**

Edit the value for `source.config.password` with the password for your Postgres user.

```javascript
"password": "strong_password"
```

#### ****

#### **service\_name**

OpenMetadata uniquely identifies services by their `service_name`. Edit the value for `source.config.service_name` with a name that distinguishes this deployment from other services, including other Postgres services that you might be ingesting metadata from.

```javascript
"service_name": "local_postgres"
```

#### ****

#### **database (optional)**

If you want to limit metadata ingestion to a single database, include the `source.config.database` field in your configuration file. If this field is not included, the connector will ingest metadata from all databases that the specified user is authorized to read.

To specify a single database to ingest metadata from, provide the name of the database as the value for the `source.config.database` key as illustrated in the example below.

```javascript
"database": "postgres_db"
```



### **3. Configure data filters (optional)**

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

#### ****

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

#### ****

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

#### ****

#### **schema\_filter\_pattern (optional)**

Use `source.config.schema_filter_pattern.excludes` and `source.config.schema_filter_pattern.includes` field to select the schemas for metadata ingestion by name. The configuration template provides an example.

The syntax and semantics for `schema_filter_pattern` are the same as for [`table_filter_pattern`](postgres-metadata-extraction.md#table\_filter\_pattern-optional). Please check that section for details.



### **4. Configure sample data (optional)**

#### **generate\_sample\_data (optional)**

Use the `source.config.generate_sample_data` field to control whether or not to generate sample data to include in table views in the OpenMetadata user interface. The image below provides an example.

![](../../../.gitbook/assets/generate\_sample\_data.png)

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



### 5. Configure DBT (optional)

DBT provides transformation logic that creates tables and views from raw data. OpenMetadata includes an integration for DBT that enables you to see the models used to generate a table from that table's details page in the OpenMetadata user interface. The image below provides an example.

![](../../../.gitbook/assets/configure\_dbt.png)

To include DBT models and metadata in your ingestion workflows, specify the location of the DBT manifest and catalog files as fields in your configuration file.



#### dbt\_manifest\_file (optional)

Use the field `source.config.dbt_manifest_file` to specify the location of your DBT manifest file. See below for an example.

```json
"dbt_manifest_file": "./dbt/manifest.json"
```



#### dbt\_catalog\_file (optional)

Use the field `source.config.dbt_catalog_file` to specify the location of your DBT catalog file. See below for an example.

```json
"dbt_catalog_file": "./dbt/catalog.json"
```



### **6. Confirm `sink` settings**

You need not make any changes to the fields defined for `sink` in the template code you copied into `postgres.json` in Step 1. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```



### **7. Confirm `metadata_server` settings**

You need not make any changes to the fields defined for `metadata_server` in the template code you copied into `postgres.json` in Step 1. This part of your configuration file should be as follows.

```javascript
"metadata_server": {
    "type": "metadata-server",
    "config": {
        "api_endpoint": "http://localhost:8585/api",
        "auth_provider_type": "no-auth"
    }
}
```



### 8. Install the Python module for this connector

Run the following command to install the Python module for the Postgres connector.

```bash
pip3 install --upgrade 'openmetadata-ingestion[postgres]'
```



### 9**. Run ingestion workflow**

Your `postgres.json` configuration file should now be fully configured and ready to use in an ingestion workflow.

To run an ingestion workflow, execute the following command from the `openmetadata` directory.

```
metadata ingest -c ./postgres.json
```

## **Next Steps**

As the ingestion workflow runs, you may observe progress both from the command line and from the OpenMetadata user interface. To view the metadata ingested from Postgres, visit [http://localhost:8585/explore/tables](http://localhost:8585/explore/tables). Select the Postgres service to filter for the data you’ve ingested using the workflow you configured and ran following this guide. The image below provides an example.

![](<../../../.gitbook/assets/next\_steps (1).png>)

## **Troubleshooting**

### **ERROR: Failed building wheel for cryptography**

When attempting to install the `openmetadata-ingestion[postgres]` Python package, you might encounter the following error. The error might include a mention of a Rust compiler.

```
Failed to build cryptography
ERROR: Could not build wheels for cryptography which use PEP 517 and cannot be installed directly
```

This error usually occurs due to an older version of pip. Try upgrading pip as follows.

```
pip3 install --upgrade pip setuptools
```

Then re-run the install command in Step 8.



### **requests.exceptions.ConnectionError**

If you encounter the following error when attempting to run the ingestion workflow in Step 9, this is probably because there is no OpenMetadata server running at http://localhost:8585.

```
requests.exceptions.ConnectionError: HTTPConnectionPool(host='localhost', port=8585): 
Max retries exceeded with url: /api/v1/services/databaseServices/name/local_postgres 
(Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x1031fa310>: 
Failed to establish a new connection: [Errno 61] Connection refused'))
```

To correct this problem, please follow the steps in the [Run OpenMetadata](https://docs.open-metadata.org/v/main/try-openmetadata/run-openmetadata) guide to deploy OpenMetadata in Docker on your local machine.

Then re-run the metadata ingestion workflow in Step 9.


{% endtab %}
{% endtabs %}
