---
description: >-
  This guide will help you configure metadata ingestion workflows using the Glue
  connector.
---

# Glue Metadata Extraction

There are three options for configuring metadata ingestion for this connector. They are as follows:

1. Schedule metadata ingestion workflows via the **Airflow SDK**. Use this option if you already have an Airflow instance running that you plan to use for workflow scheduling with OpenMetadata.
2. Schedule metadata ingestion workflows via the **OpenMetadata UI**. Use this option if you prefer to manage ingestion through the UI and are prepared to either install the [OpenMetadata Airflow REST API plugin](https://pypi.org/project/openmetadata-airflow-managed-apis/) in your Airflow deployment or will use the Airflow container that ships with OpenMetadata.
3. Use the OpenMetadata ingestion Python module to perform a **One-time ingestion**. Use this option if you want to perform a trial of OpenMetadata in a test environment

Please select the approach you would prefer to use for metadata ingestion from the tabs below.

{% tabs %}
{% tab title="Airflow SDK" %}
## Schedule Ingestion via the Airflow SDK <a href="#mysql-connector-airflow-sdk" id="mysql-connector-airflow-sdk"></a>

## **Requirements**

Using the OpenMetadata Glue connector requires supporting services and software. Please ensure that your host system meets the requirements listed below. Then continue to follow the procedure for installing and configuring this connector.



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



## Procedure

Here’s an overview of the steps in this procedure. Please follow the steps relevant to your use case.

1. Prepare a Python virtual environment
2. Install the Python module for this connector
3. Configure your AWS default profile (optional)
4. Create a configuration file using template JSON
5. Configure service settings
6. Configure data filters (optional)
7. Confirm sink settings
8. Confirm metadata\_server settings
9. Edit a Python script to define your ingestion DAG
10. Copy your configuration JSON into the ingestion script
11. Run the script to create your ingestion DAG



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
pip3 install 'openmetadata-ingestion[glue]'
```

****

### **3. Configure your AWS default profile (optional)**

In order to use the Glue Catalog connector, you will need AWS credentials configured and available to the connector. The best way to do this is by configuring your AWS default profile using the AWS Command-Line Interface (CLI). In this step we will install the AWS CLI and then configure an AWS profile.

{% hint style="info" %}
Note: If you do not have an existing AWS profile and opt not to create one, you will need to supply AWS credentials in your Glue catalog configuration file. We recommend that you use an AWS profile rather than including AWS credentials in your configuration file.
{% endhint %}

####

#### 3a. Install the AWS CLI

To install the AWS CLI, follow the installation guide for your operating system from the [AWS documentation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).



#### 3b. Configure your AWS default profile

With the AWS CLI installed, to configure your AWS profile run the following command.

```bash
aws configure
```

Then enter the appropriate values at the prompts to complete your profile. Your interaction with the `aws configure` command should look something like the following.

```bash
$ aws configure
AWS Access Key ID [None]: <your accesskey>
AWS Secret Access Key [None]: <your secretkey>
Default region name [None]: <your region, e.g., us-west-2>
Default output format [None]:
```

Please enter your `Access Key`, `Secret Key`, and `Region` when prompted. The OpenMetadata Glue Catalog connector will use the credentials from your AWS profile to connect to the right endpoint and authenticate for metadata ingestion.



#### 3c. Test access to your Glue catalog

Run the following command to ensure your AWS credentials and region are configured properly.

```
aws glue list-schemas
```

In response you will either see a formatted list of schemas defined in your Glue catalog or receive a message indicating that no schemas are defined.



### **4. Create a configuration file using template JSON**

Create a new file called `glue.json` in the current directory. Note that the current directory should be the `openmetadata` directory.

Copy and paste the configuration template below into the `glue.json` file you created.

{% hint style="info" %}
Note: The `source.config` field in the configuration JSON will include the majority of the settings for your connector. In the steps below we describe how to customize the key-value pairs in the `source.config` field to meet your needs.
{% endhint %}

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



### **5. Configure service settings**

In this step we will configure the Glue service settings required for this connector. Please follow the instructions below to ensure that you’ve configured the connector to read from your Glue service as desired.

####

#### aws\_session\_token (optional)

Edit the value for `source.config.aws_session_token` to specify a session token for your Glue client. This setting is optional.

See [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id\_credentials\_temp\_use-resources.html) for documentation on using AWS session tokens.

```json
"aws_session_token": "session_token"
```

{% hint style="info" %}
Note: While you cannot configure a session token using the `aws configure` command (see Step 3 above), you can edit the `~/.aws/credentials` file to manually add a session token. See [Configuration and credential file settings](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html) for more details.
{% endhint %}

####

#### aws\_access\_key\_id (optional)

Edit the value for `source.config.aws_access_key_id` to specify the key id for your AWS user. This setting is optional.

```json
"aws_access_key_id": "AKIAIOSFODNN7EXAMPLE"
```

{% hint style="info" %}
Note: We recommend that you use a local AWS profile containing your access key id and secret access key rather than including these values in your configuration file.
{% endhint %}

####

#### aws\_secret\_access\_key (optional)

Edit the value for `source.config.aws_secret_access_key` to specify the secret for your AWS user. This setting is optional.

```json
"aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

{% hint style="info" %}
Note: We recommend that you use a local AWS profile containing your access key id and secret access key rather than including these values in your configuration file.
{% endhint %}

####

#### service\_name

OpenMetadata associates each database and table entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata ingested from database services you are using through AWS Glue.

Edit the value for `source.config.service_name` with a name that uniquely identifies this database and table metadata.

```json
"service_name": "unique_name_to_identify_database_and_table_metadata"
```

When the metadata has been ingested you will find it in the OpenMetadata UI databases view under the name you have specified.

####

#### pipeline\_service\_name

OpenMetadata associates each pipeline entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata for pipelines you are using through AWS Glue.

Edit the value for `source.config.pipeline_service_name` with a name that uniquely identifies this pipeline metadata.

```json
"pipeline_service_name": "unique_name_to_identify_pipeline_metadata"
```

When this metadata has been ingested you will find it in the OpenMetadata UI pipelines view under the name you have specified.

####

#### storage\_service\_name (optional)

OpenMetadata associates objects for each object store entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata for the object stores you are using through AWS Glue.

Edit the value for `source.config.storage_service_name` with a name that uniquely identifies this object store metadata.

```json
"storage_service_name": "unique_name_to_identify_storage_service_metadata"
```

####

#### region\_name

Specify the region in which your Glue catalog is located using `source.config.region_name`.

```
"region_name": "region_for_your_glue_catalog"
```

{% hint style="info" %}
Note: This setting is required even if you have configured a local AWS profile and included a value for `region_name`.
{% endhint %}

####

#### endpoint\_url (optional)

The Glue connector will automatically determine the AWS Glue endpoint url based on the `region_name`.

You may specify a value for `source.config.endpoint_url` to override this behavior. The value you specify should be a complete url, including the protocol (i.e. “http" or "https”).

```json
"endpoint_url": "endpoint_url"
```



### **6. Configure data filters (optional)**

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

****

**table\_filter\_pattern (optional)**

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



### **7. Confirm `sink` settings**

You need not make any changes to the fields defined for `sink` in the template code you copied into `glue.json` in Step 4. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```



### **8. Confirm `metadata_server` settings**

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

In steps 4 - 8 above you created a JSON file with the configuration for your ingestion connector. Copy that JSON into the `openmetadata-airflow.py` file that you created in step 9 as directed by the comment below.

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

Using the OpenMetadata Glue connector requires supporting services and software. Please ensure that your host system meets the requirements listed below. Then continue to follow the procedure for setting up a Glue service and ingestion workflow using the OpenMetadata UI.



### **OpenMetadata (version 0.8.0 or later)**

You must have a running deployment of OpenMetadata to use this guide. By default, OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Apache Airflow for metadata ingestion workflows



### Apache Airflow (version 2.2 or later)

By default, OpenMetadata ships with Apache Airflow and is configured to use the distributed Airflow container. However, you may also use your own Airflow instance. To use your own Airflow instance, you will need to install the [OpenMetadata Airflow REST API plugin](https://pypi.org/project/openmetadata-airflow-managed-apis/).

## Procedure (in Beta)



### 1. Visit the _Services_ page

You may configure scheduled ingestion workflows from the _Services_ page in the OpenMetadata UI. To visit the _Services_ page, select _Services_ from the _Settings_ menu.

![](<../../../.gitbook/assets/image (16) (1) (1).png>)

### 2. Initiate a new service creation

From the Database Service UI, click the _Add New Service_ button to add your Glue service to OpenMetadata for metadata ingestion.

![](<../../../.gitbook/assets/image (30).png>)

### 3. Select service type

Select Glue as the service type.

![](<../../../.gitbook/assets/image (44).png>)



### 4. Name and describe your service

Provide a name and description for your service as illustrated below.

#### Name

OpenMetadata uniquely identifies services by their _Name_. Provide a name that distinguishes your deployment from other services, including other Glue services that you might be ingesting metadata from.

#### Description

Provide a description for your Glue service that enables other users to determine whether it might provide data of interest to them.

![](<../../../.gitbook/assets/image (24).png>)



### 5. Configure service connection

In this step, we will configure the connection settings required for this connector. Please follow the instructions below to ensure that you've configured the connector to read from your Glue service as desired.

![](<../../../.gitbook/assets/image (7).png>)

#### Host

Enter fully qualified hostname for your Glue deployment in the _Host_ field.

#### Port

Enter the port number on which your Glue deployment listens for client connections in the _Port_ field.

#### Username

Enter username of your Glue user in the _Username_ field. The user specified should be authorized to read all databases you want to include in the metadata ingestion workflow.

#### Password

Enter the password for your Glue user in the _Password_ field.&#x20;

#### Database (optional)

If you want to limit metadata ingestion to a single database, enter the name of this database in the Database field. If no value is entered for this field, the connector will ingest metadata from all databases that the specified user is authorized to read.



### 6. Configure metadata ingestion

In this step we will configure the metadata ingestion settings for your Glue deployment. Please follow the instructions below to ensure that you've configured the connector to read from your Glue service as desired.



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

![](<../../../.gitbook/assets/image (23).png>)
{% endtab %}

{% tab title="One-time Ingestion" %}
## One-time Ingestion

## **Requirements**

Using the OpenMetadata Glue connector requires supporting services and software. Please ensure that your host system meets the requirements listed below. Then continue to follow the procedure for installing and configuring this connector.



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



## Procedure

Here’s an overview of the steps in this procedure. Please follow the steps relevant to your use case.

1. Prepare a Python virtual environment
2. Install the Python module for this connector
3. Configure your AWS default profile (optional)
4. Create a configuration file using template JSON
5. Configure service settings
6. Configure data filters (optional)
7. Confirm sink settings
8. Confirm metadata\_server settings
9. Run ingestion workflow



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
pip3 install 'openmetadata-ingestion[glue]'
```

****

### **3. Configure your AWS default profile (optional)**

In order to use the Glue Catalog connector, you will need AWS credentials configured and available to the connector. The best way to do this is by configuring your AWS default profile using the AWS Command-Line Interface (CLI). In this step we will install the AWS CLI and then configure an AWS profile.

{% hint style="info" %}
Note: If you do not have an existing AWS profile and opt not to create one, you will need to supply AWS credentials in your Glue catalog configuration file. We recommend that you use an AWS profile rather than including AWS credentials in your configuration file.
{% endhint %}

####

#### 3a. Install the AWS CLI

To install the AWS CLI, follow the installation guide for your operating system from the [AWS documentation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

####

#### 3b. Configure your AWS default profile

With the AWS CLI installed, to configure your AWS profile run the following command.

```bash
aws configure
```

Then enter the appropriate values at the prompts to complete your profile. Your interaction with the `aws configure` command should look something like the following.

```bash
$ aws configure
AWS Access Key ID [None]: <your accesskey>
AWS Secret Access Key [None]: <your secretkey>
Default region name [None]: <your region, e.g., us-west-2>
Default output format [None]:
```

Please enter your `Access Key`, `Secret Key`, and `Region` when prompted. The OpenMetadata Glue Catalog connector will use the credentials from your AWS profile to connect to the right endpoint and authenticate for metadata ingestion.

####

#### 3c. Test access to your Glue catalog

Run the following command to ensure your AWS credentials and region are configured properly.

```
aws glue list-schemas
```

In response you will either see a formatted list of schemas defined in your Glue catalog or receive a message indicating that no schemas are defined.



### **4. Create a configuration file using template JSON**

Create a new file called `glue.json`. Copy and paste the configuration template below into the `glue.json` file you created.

{% hint style="info" %}
Note: The `source.config` field in the configuration JSON will include the majority of the settings for your connector. In the steps below we describe how to customize the key-value pairs in the `source.config` field to meet your needs.
{% endhint %}

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



### **5. Configure service settings**

In this step we will configure the Glue service settings required for this connector. Please follow the instructions below to ensure that you’ve configured the connector to read from your Glue service as desired.

####

#### aws\_session\_token (optional)

Edit the value for `source.config.aws_session_token` to specify a session token for your Glue client. This setting is optional.

See [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id\_credentials\_temp\_use-resources.html) for documentation on using AWS session tokens.

```json
"aws_session_token": "session_token"
```

{% hint style="info" %}
Note: While you cannot configure a session token using the `aws configure` command (see Step 3 above), you can edit the `~/.aws/credentials` file to manually add a session token. See [Configuration and credential file settings](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html) for more details.
{% endhint %}

####

#### aws\_access\_key\_id (optional)

Edit the value for `source.config.aws_access_key_id` to specify the key id for your AWS user. This setting is optional.

```json
"aws_access_key_id": "AKIAIOSFODNN7EXAMPLE"
```

{% hint style="info" %}
Note: We recommend that you use a local AWS profile containing your access key id and secret access key rather than including these values in your configuration file.
{% endhint %}

####

#### aws\_secret\_access\_key (optional)

Edit the value for `source.config.aws_secret_access_key` to specify the secret for your AWS user. This setting is optional.

```json
"aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

{% hint style="info" %}
Note: We recommend that you use a local AWS profile containing your access key id and secret access key rather than including these values in your configuration file.
{% endhint %}

####

#### service\_name

OpenMetadata associates each database and table entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata ingested from database services you are using through AWS Glue.

Edit the value for `source.config.service_name` with a name that uniquely identifies this database and table metadata.

```json
"service_name": "unique_name_to_identify_database_and_table_metadata"
```

When the metadata has been ingested you will find it in the OpenMetadata UI databases view under the name you have specified.

####

#### pipeline\_service\_name

OpenMetadata associates each pipeline entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata for pipelines you are using through AWS Glue.

Edit the value for `source.config.pipeline_service_name` with a name that uniquely identifies this pipeline metadata.

```json
"pipeline_service_name": "unique_name_to_identify_pipeline_metadata"
```

When this metadata has been ingested you will find it in the OpenMetadata UI pipelines view under the name you have specified.

####

#### storage\_service\_name (optional)

OpenMetadata associates objects for each object store entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata for the object stores you are using through AWS Glue.

Edit the value for `source.config.storage_service_name` with a name that uniquely identifies this object store metadata.

```json
"storage_service_name": "unique_name_to_identify_storage_service_metadata"
```

####

#### region\_name

Specify the region in which your Glue catalog is located using `source.config.region_name`.

```
"region_name": "region_for_your_glue_catalog"
```

{% hint style="info" %}
Note: This setting is required even if you have configured a local AWS profile and included a value for `region_name`.
{% endhint %}

####

#### endpoint\_url (optional)

The Glue connector will automatically determine the AWS Glue endpoint url based on the `region_name`.

You may specify a value for `source.config.endpoint_url` to override this behavior. The value you specify should be a complete url, including the protocol (i.e. “http" or "https”).

```json
"endpoint_url": "endpoint_url"
```



### **6. Configure data filters (optional)**

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

****

**table\_filter\_pattern (optional)**

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



### **7. Confirm `sink` settings**

You need not make any changes to the fields defined for `sink` in the template code you copied into `glue.json` in Step 4. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```



### **8. Confirm `metadata_server` settings**

You need not make any changes to the fields defined for `metadata_server` in the template code you copied into `glue.json` in Step 2. This part of your configuration file should be as follows.

```javascript
"metadata_server": {
    "type": "metadata-server",
    "config": {
        "api_endpoint": "http://localhost:8585/api",
        "auth_provider_type": "no-auth"
    }
}
```



### **9. Run ingestion workflow**

Your `glue.json` configuration file should now be fully configured and ready to use in an ingestion workflow.

To run an ingestion workflow, execute the following command from the `openmetadata` directory.

```
metadata ingest -c ./glue.json
```

## **Next Steps**

As the ingestion workflow runs, you may observe progress both from the command line and from the OpenMetadata user interface. To view the metadata ingested from Glue, visit [http://localhost:8585/explore/tables](http://localhost:8585/explore/tables). Select the Glue service to filter for the data you’ve ingested using the workflow you configured and ran following this guide. The image below provides an example.

![](<../../../.gitbook/assets/next\_steps (1).png>)

## **Troubleshooting**

### **ERROR: Failed building wheel for cryptography**

When attempting to install the `openmetadata-ingestion[glue]` Python package, you might encounter the following error. The error might include a mention of a Rust compiler.

```
Failed to build cryptography
ERROR: Could not build wheels for cryptography which use PEP 517 and cannot be installed directly
```

This error usually occurs due to an older version of pip. Try upgrading pip as follows.

```
pip3 install --upgrade pip setuptools
```

Then re-run the install command in Step 2.

### ****

### **requests.exceptions.ConnectionError**

If you encounter the following error when attempting to run the ingestion workflow in Step 9, this is probably because there is no OpenMetadata server running at http://localhost:8585.

```
requests.exceptions.ConnectionError: HTTPConnectionPool(host='localhost', port=8585): 
Max retries exceeded with url: /api/v1/services/databaseServices/name/local_glue 
(Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x1031fa310>: 
Failed to establish a new connection: [Errno 61] Connection refused'))
```

To correct this problem, please follow the steps in the [Run OpenMetadata](https://docs.open-metadata.org/v/main/try-openmetadata/run-openmetadata) guide to deploy OpenMetadata in Docker on your local machine.

Then re-run the metadata ingestion workflow in Step 9.
{% endtab %}
{% endtabs %}

